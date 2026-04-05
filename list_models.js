const fs = require('fs');

async function list() {
    try {
        const env = fs.readFileSync('.env', 'utf8');
        const match = env.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
        if (!match) { console.log("No Key"); return; }
        const key = match[1].trim();

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();

        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log("No models field:", data);
        }

    } catch (e) {
        console.error(e);
    }
}
list();
