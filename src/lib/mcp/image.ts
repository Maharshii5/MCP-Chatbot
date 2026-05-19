// Kie.ai GPT Image 1 Generation
export async function generateImage(prompt: string, aspectRatio: string = "1:1") {
    const KIE_API_KEY = process.env.KIE_AI_API_KEY;
    const POLL_INTERVAL_MS = 3000;
    const MAX_POLLS = 30;

    if (!KIE_API_KEY) {
        throw new Error("Missing KIE_AI_API_KEY");
    }

    try {
        console.log(`[ImageGen] Generating via Kie.ai GPT Image 1: "${prompt}"`);

        // Map aspect ratio to Kie.ai format
        let size = "1:1";
        if (aspectRatio === "16:9") size = "3:2"; // Closest match
        else if (aspectRatio === "4:3") size = "3:2";
        else if (aspectRatio === "3:4") size = "2:3";

        // Step 1: Create generation task
        const genResponse = await fetch("https://api.kie.ai/api/v1/gpt4o-image/generate", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${KIE_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                size: size,
                enableFallback: true,
                fallbackModel: "GPT_IMAGE_1"
            })
        });

        if (!genResponse.ok) {
            const errorText = await genResponse.text();
            console.error(`Kie.ai API Error: ${genResponse.status}`, errorText);
            if (genResponse.status === 402 || genResponse.status === 403) {
                throw new Error(`Kie.ai billing/auth error (${genResponse.status}). Check the KIE_AI_API_KEY and account balance. Raw response: ${errorText}`);
            }
            if (genResponse.status === 429) {
                throw new Error(`Kie.ai quota/rate limit hit (429). Raw response: ${errorText}`);
            }
            throw new Error(`Kie.ai API Error ${genResponse.status}: ${errorText}`);
        }

        const genData = await genResponse.json();

        if (genData.code !== 200 || !genData.data?.taskId) {
            console.error("Kie.ai generation failed:", genData);
            if (String(genData.msg || '').toLowerCase().match(/quota|billing|balance|insufficient|credit|rate/i)) {
                throw new Error(`Kie.ai rejected the image request due to quota/billing: ${genData.msg}`);
            }
            throw new Error(`Kie.ai Error: ${genData.msg || "Unknown error"}`);
        }

        const taskId = genData.data.taskId;
        console.log(`[ImageGen] Task created: ${taskId}, polling for completion...`);

        // Step 2: Poll for completion (up to ~90 seconds, check every 3 seconds)
        for (let i = 0; i < MAX_POLLS; i++) {
            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

            const statusResponse = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
                headers: {
                    "Authorization": `Bearer ${KIE_API_KEY}`
                }
            });

            if (!statusResponse.ok) {
                console.error(`Status check failed: ${statusResponse.status}`);
                continue;
            }

            const statusData = await statusResponse.json();

            if (statusData.data?.status === "SUCCESS" && statusData.data?.response?.resultUrls?.length > 0) {
                const imageUrl = statusData.data.response.resultUrls[0];
                console.log(`✅ Image generated successfully: ${imageUrl}`);
                return `![Generated Image](${imageUrl})`;
            }

            if (statusData.data?.status === "FAILED") {
                const errorMsg = statusData.data?.errorMessage || "Unknown error";
                console.error(`Image generation failed: ${errorMsg}`);
                if (String(errorMsg).toLowerCase().match(/quota|billing|balance|insufficient|credit|rate/i)) {
                    throw new Error(`Kie.ai task failed due to quota/billing: ${errorMsg}`);
                }
                throw new Error(`Image generation failed: ${errorMsg}`);
            }

            console.log(`[ImageGen] Poll ${i + 1}: ${statusData.data?.status || "PENDING"}`);
        }

        // Final status fetch before giving up, in case the task completed between polls.
        const finalStatusResponse = await fetch(`https://api.kie.ai/api/v1/gpt4o-image/record-info?taskId=${taskId}`, {
            headers: {
                "Authorization": `Bearer ${KIE_API_KEY}`
            }
        });

        if (finalStatusResponse.ok) {
            const finalStatusData = await finalStatusResponse.json();
            if (finalStatusData.data?.status === "SUCCESS" && finalStatusData.data?.response?.resultUrls?.length > 0) {
                const imageUrl = finalStatusData.data.response.resultUrls[0];
                console.log(`[ImageGen] Final status check succeeded: ${imageUrl}`);
                return `![Generated Image](${imageUrl})`;
            }
        }

        throw new Error(`Image generation timed out after ${Math.round((MAX_POLLS * POLL_INTERVAL_MS) / 1000)} seconds`);

    } catch (error: any) {
        console.error("Image generation failed:", error);
        return `Failed to generate image: ${error.message}`;
    }
}
