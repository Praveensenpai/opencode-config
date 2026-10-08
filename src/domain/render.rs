use crate::domain::models::Secrets;

const BASE_URL_TOKEN: &str = "__MOCHI_BASE_URL__";
const API_KEY_TOKEN: &str = "__MOCHI_API_KEY__";

pub fn render_template(template: &str, secrets: &Secrets) -> String {
    template
        .replace(BASE_URL_TOKEN, &secrets.base_url)
        .replace(API_KEY_TOKEN, &secrets.api_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_both_tokens() {
        let secrets = Secrets {
            base_url: "http://x".into(),
            api_key: "k".into(),
        };
        let out = render_template("a __MOCHI_BASE_URL__ b __MOCHI_API_KEY__", &secrets);
        assert_eq!(out, "a http://x b k");
    }
}
