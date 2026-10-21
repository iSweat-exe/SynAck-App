//! A fake Supabase for tests: a tiny HTTP server on the loopback interface that records what it
//! receives and answers what the test tells it to.

use std::sync::{Arc, Mutex, PoisonError};

use serde_json::Value;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

#[derive(Clone)]
pub struct Recorded {
    pub target: String,
    headers: Vec<(String, String)>,
    pub body: String,
}

impl Recorded {
    pub fn path(&self) -> &str {
        self.target.split('?').next().unwrap_or_default()
    }

    /// A query parameter of the request.
    pub fn query(&self, name: &str) -> Option<String> {
        let url = url::Url::parse(&format!("http://mock{}", self.target)).ok()?;
        url.query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    }

    /// A header, found whatever its case.
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .map(|(_, value)| value.as_str())
    }

    pub fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
}

pub struct Mock {
    pub url: String,
    requests: Arc<Mutex<Vec<Recorded>>>,
}

impl Mock {
    pub async fn start(
        handler: impl Fn(&Recorded) -> (u16, String) + Send + Sync + 'static,
    ) -> Self {
        let listener = TcpListener::bind(("127.0.0.1", 0)).await.unwrap();
        let url = format!("http://127.0.0.1:{}", listener.local_addr().unwrap().port());
        let requests = Arc::new(Mutex::new(Vec::new()));
        let handler = Arc::new(handler);

        let recorded = Arc::clone(&requests);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                let (recorded, handler) = (Arc::clone(&recorded), Arc::clone(&handler));
                tokio::spawn(async move {
                    let _ = read_request(stream, &*handler, &recorded).await;
                });
            }
        });
        Self { url, requests }
    }

    pub fn requests(&self) -> Vec<Recorded> {
        self.requests
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    pub fn requests_to(&self, path: &str) -> Vec<Recorded> {
        self.requests()
            .into_iter()
            .filter(|request| request.path() == path)
            .collect()
    }
}

async fn read_request(
    mut stream: TcpStream,
    handler: &(dyn Fn(&Recorded) -> (u16, String) + Send + Sync),
    recorded: &Mutex<Vec<Recorded>>,
) -> Option<()> {
    let mut buffer = Vec::new();
    let mut chunk = [0_u8; 4096];
    let head_end = loop {
        if let Some(position) = buffer.windows(4).position(|w| w == b"\r\n\r\n") {
            break position;
        }
        let read = stream.read(&mut chunk).await.ok()?;
        if read == 0 {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
    };

    let head = String::from_utf8_lossy(&buffer[..head_end]).into_owned();
    let mut lines = head.split("\r\n");
    let mut request_line = lines.next()?.split(' ');
    let _method = request_line.next()?;
    let target = request_line.next()?.to_owned();
    let headers: Vec<(String, String)> = lines
        .filter_map(|line| line.split_once(':'))
        .map(|(name, value)| (name.trim().to_owned(), value.trim().to_owned()))
        .collect();

    let length: usize = headers
        .iter()
        .find(|(name, _)| name.eq_ignore_ascii_case("content-length"))
        .and_then(|(_, value)| value.parse().ok())
        .unwrap_or(0);
    while buffer.len() < head_end + 4 + length {
        let read = stream.read(&mut chunk).await.ok()?;
        if read == 0 {
            break;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let body = String::from_utf8_lossy(&buffer[head_end + 4..]).into_owned();

    let request = Recorded {
        target,
        headers,
        body,
    };
    let (status, reply) = handler(&request);
    recorded
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .push(request);

    let answer = format!(
        "HTTP/1.1 {status} X\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\
         Connection: close\r\n\r\n{reply}",
        reply.len()
    );
    stream.write_all(answer.as_bytes()).await.ok()?;
    stream.shutdown().await.ok()?;
    Some(())
}
