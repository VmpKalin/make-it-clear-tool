use crate::config::Action;

pub fn system_prompt(action: Action) -> &'static str {
    match action {
        Action::Grammar => "You are a grammar correction assistant. Fix grammar, spelling, and punctuation errors in the given English text. Return ONLY the corrected text, no explanations, no quotes, no markdown.",
        Action::Rewrite => "You are a writing assistant. Rewrite the given English text to be clearer and more professional while preserving its meaning. Return ONLY the rewritten text, no explanations.",
        Action::Shorten => "You are a writing assistant. Shorten the given English text while preserving its key meaning. Return ONLY the shortened text, no explanations.",
        Action::Bullets => "You are a writing assistant. Convert the given English text into a concise bullet point list. Return ONLY the bullet points, no intro, no explanations.",
        Action::Translate => "You are a translation assistant. Detect the language of the given text. If it is Ukrainian — translate to English. If it is English — translate to Ukrainian. If the text contains an explicit instruction like \"translate to X\" or \"переклади на X\" — follow that instruction instead. Return ONLY the translated text, no explanations, no quotes, no markdown.",
    }
}
