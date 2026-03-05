const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');

async function listModels() {
    // Read .env manually
    let apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        try {
            const envPath = path.resolve(__dirname, '../.env');
            const envContent = fs.readFileSync(envPath, 'utf8');
            const match = envContent.match(/GEMINI_API_KEY=["']?([^"'\n]+)["']?/);
            if (match) apiKey = match[1];
        } catch (e) {
            console.error("Could not read .env file");
        }
    }

    console.log("Fetching models with key:", apiKey ? "Present" : "Missing");

    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();

        if (data.error) {
            console.error("Error listing models:", JSON.stringify(data.error, null, 2));
        } else {
            console.log("Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods.includes("generateContent")) {
                    console.log(`- ${m.name}`);
                }
            });
        }
    } catch (error) {
        console.error("Failed to list models:", error);
    }
}

listModels();
