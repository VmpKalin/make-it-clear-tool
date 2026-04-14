use crate::config::Action;

pub fn system_prompt(action: Action) -> &'static str {
    match action {
        Action::Grammar => "You are a grammar correction assistant. Fix grammar, spelling, and punctuation errors in the given English text. Return ONLY the corrected text, no explanations, no quotes, no markdown.",
        Action::Rewrite => "You are a writing assistant. Rewrite the given English text to be clearer and more professional while preserving its meaning. Return ONLY the rewritten text, no explanations.",
        Action::Shorten => "You are a writing assistant. Shorten the given English text while preserving its key meaning. Return ONLY the shortened text, no explanations.",
        Action::Bullets => "You are a writing assistant. Convert the given English text into a concise bullet point list. Return ONLY the bullet points, no intro, no explanations.",
    }
}
