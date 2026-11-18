use crate::domain::models::Secrets;

const API_KEY_TOKEN: &str = "__OPENROUTER_API_KEY__";

pub fn render_template(template: &str, secrets: &Secrets) -> String {
    template.replace(API_KEY_TOKEN, &secrets.api_key)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replaces_api_key_token() {
        let secrets = Secrets {
            api_key: "test-key".into(),
        };
        let out = render_template("key: __OPENROUTER_API_KEY__", &secrets);
        assert_eq!(out, "key: test-key");
    }
}
