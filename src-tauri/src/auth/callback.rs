//! The loopback server that receives the browser's redirect after sign-in (RFC 8252 §7.3).
//!
//! It listens on `127.0.0.1` only, answers nothing but `GET /callback?code=...` for the right
//! `Host`, shows a fixed page (never anything taken from the request), and stops at the first
//! valid answer. The code it returns is useless without the PKCE verifier kept by the app.

use std::time::Duration;

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use url::Url;

use crate::error::AppError;

pub const CALLBACK_PATH: &str = "/callback";

/// A request head larger than this is not a browser redirect.
const MAX_HEAD_BYTES: usize = 8 * 1024;

/// A client that connects and says nothing must not hold the server.
const READ_TIMEOUT: Duration = Duration::from_secs(5);

const MAX_CODE_CHARS: usize = 512;

/// Starts listening on the loopback interface. Port `0` lets the system pick one (tests).
///
/// # Errors
///
/// Returns an error if the port is taken or cannot be opened.
pub async fn bind(port: u16) -> Result<TcpListener, AppError> {
    TcpListener::bind(("127.0.0.1", port))
        .await
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AddrInUse {
                AppError::AuthPortBusy(port)
            } else {
                AppError::Io(error)
            }
        })
}

/// What a request to the loopback server turned out to be.
#[derive(Debug, PartialEq, Eq)]
enum Parsed {
    /// The redirect carrying the authorization code.
    Code(String),
    /// The provider or the user refused the sign-in.
    Denied,
    /// Anything else (a favicon request, a probe, a malformed request).
    Unrelated,
}

fn parse_request(head: &str, expected_host: &str) -> Parsed {
    let mut lines = head.split("\r\n");
    let mut request_line = lines.next().unwrap_or_default().split(' ');
    let (Some("GET"), Some(target), Some(version)) = (
        request_line.next(),
        request_line.next(),
        request_line.next(),
    ) else {
        return Parsed::Unrelated;
    };
    if !version.starts_with("HTTP/1.") {
        return Parsed::Unrelated;
    }

    // A page on the web must not be able to make the browser talk to us under another name
    // (DNS rebinding): the `Host` has to be exactly the loopback address we gave.
    let host_matches = lines.any(|line| {
        line.split_once(':').is_some_and(|(name, value)| {
            name.eq_ignore_ascii_case("host") && value.trim() == expected_host
        })
    });
    if !host_matches {
        return Parsed::Unrelated;
    }

    let Ok(url) = Url::parse(&format!("http://{expected_host}{target}")) else {
        return Parsed::Unrelated;
    };
    if url.path() != CALLBACK_PATH {
        return Parsed::Unrelated;
    }

    let mut code = None;
    for (key, value) in url.query_pairs() {
        match key.as_ref() {
            "error" => return Parsed::Denied,
            "code" if !value.is_empty() && value.chars().count() <= MAX_CODE_CHARS => {
                code = Some(value.into_owned());
            }
            _ => {}
        }
    }
    code.map_or(Parsed::Unrelated, Parsed::Code)
}

const PAGE_STYLE: &str = "body{margin:0;min-height:100vh;display:grid;place-items:center;\
background:#f3f0f2;color:#121011;font-family:'Courier New',monospace}\
main{max-width:26rem;padding:2rem;background:#fff;border:2px solid #121011;border-radius:8px;\
box-shadow:6px 6px 0 #000}h1{margin:0 0 1rem}\
.ack{padding:.1rem .4rem;background:#fb84c3;border:2px solid #121011;border-radius:4px}\
p{margin:0;line-height:1.6}";

fn page(message: &str) -> String {
    format!(
        "<!doctype html><html lang=\"fr\"><meta charset=\"utf-8\"><title>SynAck</title>\
         <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\
         <style>{PAGE_STYLE}</style><main><h1>Syn<span class=\"ack\">Ack</span></h1>\
         <p>{message}</p></main></html>"
    )
}

/// A response whose headers keep the page inert: no scripts, no framing, no referrer, no cache.
fn response(status: &str, content_type: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nReferrer-Policy: no-referrer\r\n\
         X-Content-Type-Options: nosniff\r\nX-Frame-Options: DENY\r\n\
         Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'\r\n\
         Connection: close\r\n\r\n{body}",
        body.len()
    )
}

async fn read_head(stream: &mut TcpStream) -> Option<String> {
    let mut buffer = Vec::with_capacity(1024);
    let mut chunk = [0_u8; 1024];
    loop {
        let read = tokio::time::timeout(READ_TIMEOUT, stream.read(&mut chunk))
            .await
            .ok()?
            .ok()?;
        if read == 0 {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
        if buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if buffer.len() > MAX_HEAD_BYTES {
            return None;
        }
    }
    Some(String::from_utf8_lossy(&buffer).into_owned())
}

/// Serves one connection. `Some` means the sign-in is over (success or refusal).
async fn serve(mut stream: TcpStream, expected_host: &str) -> Option<Result<String, AppError>> {
    let head = read_head(&mut stream).await?;
    let parsed = parse_request(&head, expected_host);

    let (reply, outcome) = match parsed {
        Parsed::Code(code) => (
            response(
                "200 OK",
                "text/html; charset=utf-8",
                &page("Connexion réussie. Tu peux fermer cet onglet et revenir à l'application."),
            ),
            Some(Ok(code)),
        ),
        Parsed::Denied => (
            response(
                "400 Bad Request",
                "text/html; charset=utf-8",
                &page("La connexion a été refusée. Tu peux fermer cet onglet et réessayer."),
            ),
            Some(Err(AppError::AuthRejected)),
        ),
        Parsed::Unrelated => (
            response("404 Not Found", "text/plain; charset=utf-8", "Not found"),
            None,
        ),
    };
    // The browser may already have left: a failed write changes nothing for the sign-in.
    let _ = stream.write_all(reply.as_bytes()).await;
    let _ = stream.shutdown().await;
    outcome
}

/// Waits for the redirect carrying the authorization code. Other requests are answered with a
/// 404 and ignored.
///
/// # Errors
///
/// Returns [`AppError::AuthRejected`] if the sign-in was refused, or an I/O error if the
/// listener fails.
pub async fn wait_for_code(listener: &TcpListener) -> Result<String, AppError> {
    let expected_host = format!("127.0.0.1:{}", listener.local_addr()?.port());
    loop {
        let (stream, _peer) = listener.accept().await?;
        if let Some(outcome) = serve(stream, &expected_host).await {
            return outcome;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HOST: &str = "127.0.0.1:53682";

    fn request(target: &str, host: &str) -> String {
        format!("GET {target} HTTP/1.1\r\nHost: {host}\r\nUser-Agent: test\r\n\r\n")
    }

    #[test]
    fn parse_request_should_return_the_code_when_the_redirect_is_valid() {
        assert_eq!(
            parse_request(&request("/callback?code=abc-123", HOST), HOST),
            Parsed::Code("abc-123".to_owned())
        );
    }

    #[test]
    fn parse_request_should_decode_the_code_when_it_is_percent_encoded() {
        assert_eq!(
            parse_request(&request("/callback?code=a%2Bb", HOST), HOST),
            Parsed::Code("a+b".to_owned())
        );
    }

    #[test]
    fn parse_request_should_report_a_refusal_when_the_provider_returns_an_error() {
        assert_eq!(
            parse_request(&request("/callback?error=access_denied", HOST), HOST),
            Parsed::Denied
        );
    }

    #[test]
    fn parse_request_should_prefer_the_refusal_when_both_an_error_and_a_code_are_present() {
        assert_eq!(
            parse_request(
                &request("/callback?code=abc&error=access_denied", HOST),
                HOST
            ),
            Parsed::Denied
        );
    }

    #[test]
    fn parse_request_should_ignore_another_path_when_it_is_not_the_callback() {
        assert_eq!(
            parse_request(&request("/favicon.ico", HOST), HOST),
            Parsed::Unrelated
        );
    }

    #[test]
    fn parse_request_should_ignore_a_path_that_only_starts_like_the_callback() {
        assert_eq!(
            parse_request(&request("/callback/extra?code=abc", HOST), HOST),
            Parsed::Unrelated
        );
    }

    #[test]
    fn parse_request_should_ignore_the_request_when_the_host_is_not_the_loopback_address() {
        assert_eq!(
            parse_request(&request("/callback?code=abc", "evil.example:53682"), HOST),
            Parsed::Unrelated
        );
    }

    #[test]
    fn parse_request_should_ignore_the_request_when_there_is_no_host_header() {
        let head = "GET /callback?code=abc HTTP/1.1\r\n\r\n";
        assert_eq!(parse_request(head, HOST), Parsed::Unrelated);
    }

    #[test]
    fn parse_request_should_ignore_a_method_other_than_get() {
        let head = format!("POST /callback?code=abc HTTP/1.1\r\nHost: {HOST}\r\n\r\n");
        assert_eq!(parse_request(&head, HOST), Parsed::Unrelated);
    }

    #[test]
    fn parse_request_should_ignore_a_request_without_a_code() {
        assert_eq!(
            parse_request(&request("/callback", HOST), HOST),
            Parsed::Unrelated
        );
    }

    #[test]
    fn parse_request_should_ignore_an_absurdly_long_code() {
        let target = format!("/callback?code={}", "a".repeat(MAX_CODE_CHARS + 1));
        assert_eq!(
            parse_request(&request(&target, HOST), HOST),
            Parsed::Unrelated
        );
    }

    #[test]
    fn response_should_forbid_scripts_framing_referrers_and_caching() {
        let reply = response("200 OK", "text/html", "x");
        for header in [
            "Content-Security-Policy: default-src 'none'",
            "X-Frame-Options: DENY",
            "Referrer-Policy: no-referrer",
            "Cache-Control: no-store",
            "X-Content-Type-Options: nosniff",
        ] {
            assert!(reply.contains(header), "missing {header}");
        }
    }

    /// Sends a raw request to the server, like a browser would, and returns the whole answer.
    async fn browser_request(port: u16, raw: String) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).await.unwrap();
        stream.write_all(raw.as_bytes()).await.unwrap();
        let mut answer = String::new();
        stream.read_to_string(&mut answer).await.unwrap();
        answer
    }

    #[tokio::test]
    async fn wait_for_code_should_return_the_code_and_show_a_fixed_page_when_the_browser_is_redirected()
     {
        let listener = bind(0).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let host = format!("127.0.0.1:{port}");

        let browser = tokio::spawn(async move {
            browser_request(port, request("/callback?code=the-code", &host)).await
        });
        let code = wait_for_code(&listener).await.unwrap();
        let page = browser.await.unwrap();

        assert_eq!(code, "the-code");
        assert!(page.starts_with("HTTP/1.1 200 OK"));
        assert!(page.contains("Connexion réussie"));
        // Nothing from the request may be echoed back.
        assert!(!page.contains("the-code"));
    }

    #[tokio::test]
    async fn wait_for_code_should_keep_waiting_when_an_unrelated_request_comes_first() {
        let listener = bind(0).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let host = format!("127.0.0.1:{port}");

        let browser = tokio::spawn(async move {
            let favicon = browser_request(port, request("/favicon.ico", &host)).await;
            browser_request(port, request("/callback?code=real", &host)).await;
            favicon
        });
        let code = wait_for_code(&listener).await.unwrap();

        assert_eq!(code, "real");
        assert!(browser.await.unwrap().starts_with("HTTP/1.1 404"));
    }

    #[tokio::test]
    async fn wait_for_code_should_fail_when_the_provider_refuses_the_sign_in() {
        let listener = bind(0).await.unwrap();
        let port = listener.local_addr().unwrap().port();
        let host = format!("127.0.0.1:{port}");

        tokio::spawn(async move {
            browser_request(port, request("/callback?error=access_denied", &host)).await
        });
        let outcome = wait_for_code(&listener).await;

        assert!(matches!(outcome, Err(AppError::AuthRejected)));
    }

    #[tokio::test]
    async fn bind_should_report_a_busy_port_when_another_program_already_listens_on_it() {
        let first = bind(0).await.unwrap();
        let port = first.local_addr().unwrap().port();
        assert!(matches!(bind(port).await, Err(AppError::AuthPortBusy(busy)) if busy == port));
    }
}
