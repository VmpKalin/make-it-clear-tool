use crate::config::Action;

const PROMPTS_MD: &str = include_str!("../../../shared/prompts.md");

pub fn system_prompt(action: Action) -> &'static str {
    let slug = match action {
        Action::Grammar => "grammar",
        Action::Rewrite => "rewrite",
        Action::Shorten => "shorten",
        Action::Bullets => "bullets",
        Action::Translate => "translate",
        Action::Format => "format",
    };

    parse_section(slug).unwrap_or_else(|| {
        eprintln!("[desktop/prompts] Missing section '## {slug}' in prompts.md");
        "You are a helpful assistant."
    })
}

fn parse_section(slug: &str) -> Option<&'static str> {
    let header = format!("## {slug}");
    let start = PROMPTS_MD.find(&header)?;
    let after_header = start + header.len();
    let body_start = PROMPTS_MD[after_header..].find('\n')? + after_header + 1;

    let body_end = PROMPTS_MD[body_start..]
        .find("\n## ")
        .map(|i| body_start + i)
        .unwrap_or(PROMPTS_MD.len());

    let section = PROMPTS_MD[body_start..body_end].trim();
    if section.is_empty() { None } else { Some(section) }
}
