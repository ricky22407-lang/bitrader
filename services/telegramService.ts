
export const sendTelegramMessage = async (token: string, chatId: string, message: string) => {
  if (!token || !chatId) return;
  
  // Telegram API endpoint
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown' // Allows bolding, etc.
      })
    });

    if (!response.ok) {
        const err = await response.text();
        console.warn('Telegram API Error:', err);
    }
  } catch (e) {
    console.warn("Telegram Send Failed (Likely CORS if browser blocked):", e);
    // Note: If this fails in browser due to CORS, user must use a CORS extension or run a local proxy.
  }
};
