export async function sendWhatsAppTemplate(
  waId: string,
  templateName: string,
  dynamicUrlParam: string,
  languageCode: string = 'fr'
) {
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    console.error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID manquants.');
    return { success: false, error: 'Configuration WhatsApp manquante.' };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: waId,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode
      },
      components: [
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            {
              type: 'text',
              text: dynamicUrlParam
            }
          ]
        }
      ]
    }
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: 'Failed to parse JSON' }));

    if (!response.ok) {
      console.error('Meta Template API Error:', JSON.stringify(data));
      // On retourne une erreur bloquante comme demandé pour le test si non approuvé
      return { success: false, error: data?.error?.message || 'Erreur lors de l\'envoi du template.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Meta Template Network Error:', err);
    return { success: false, error: 'Erreur réseau.' };
  }
}
