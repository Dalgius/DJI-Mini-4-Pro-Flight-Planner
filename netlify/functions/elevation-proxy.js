// File: netlify/functions/elevation-proxy.js
const axios = require('axios'); // Netlify installerà questo automaticamente

exports.handler = async function(event, context) {
    // L'URL target viene passato come parametro query chiamato 'url'
    // event.queryStringParameters.url
    const targetUrlEncoded = event.queryStringParameters.url;

    if (!targetUrlEncoded) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing "url" query parameter.' })
        };
    }

    const targetUrlDecoded = decodeURIComponent(targetUrlEncoded);
    console.log(`Netlify Proxy: Attempting to fetch: ${targetUrlDecoded}`);

    try {
        const response = await axios({
            method: event.httpMethod, // Usa il metodo originale della richiesta
            url: targetUrlDecoded,
            responseType: 'text', // Ottieni come testo per inoltrare correttamente
            // Inoltra alcuni header se necessario, ma per GET semplici di solito non serve
            // headers: { 
            //   'User-Agent': 'Netlify-Function-Proxy/1.0' 
            // }
        });

        console.log(`Netlify Proxy: Received response from ${targetUrlDecoded} with status ${response.status}`);
        
        return {
            statusCode: response.status,
            headers: { 
                'Content-Type': response.headers['content-type'] || 'application/json',
                // Netlify aggiunge automaticamente gli header CORS permissivi per le funzioni,
                // ma è buona pratica essere espliciti se si vuole un controllo fine.
                // 'Access-Control-Allow-Origin': '*', 
                // 'Access-Control-Allow-Headers': 'Content-Type',
                // 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' 
            },
            body: response.data // response.data conterrà la stringa (JSON o altro)
        };

    } catch (error) {
        console.error(`Netlify Proxy: Error fetching ${targetUrlDecoded}:`, error.message);
        if (error.response) {
            console.error('Netlify Proxy: Target server error details:', error.response.status, error.response.data);
            return {
                statusCode: error.response.status,
                headers: {'Content-Type': error.response.headers['content-type'] || 'text/plain'},
                body: typeof error.response.data === 'string' ? error.response.data : JSON.stringify({error: `Error from target server: ${error.response.status}`})
            };
        } else if (error.request) {
            console.error('Netlify Proxy: No response from target server:', error.request);
            return {
                statusCode: 504, // Gateway Timeout
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Gateway Timeout: No response from target server.' })
            };
        } else {
            console.error('Netlify Proxy: Request setup error:', error.message);
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Internal proxy server error: Request setup problem.' })
            };
        }
    }
};
