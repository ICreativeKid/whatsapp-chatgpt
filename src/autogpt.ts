import axios from 'axios';

export const fetchGptResponse = async (text: string) => {
    console.log(`Sending message: ${text}`);
    try {
        const response = await fetch('http://0.0.0.0:8000/get_gpt_response/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
        });

        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.status}`);
        }

        const jsonResponse = await response.json();
        console.log(`JSON response: ${JSON.stringify(jsonResponse)}`);
        return jsonResponse.response;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch response');
    }
};
