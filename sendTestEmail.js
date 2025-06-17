// Polyfill fetch and Headers for Node.js 16
const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;


const { Resend } = require('resend');

// 1. Initialize Resend client with your real API key
const resend = new Resend('re_Bo8LWRqs_4soYNDZKwn2SWGoH56jQqxq1');

// 2. Define and send the email
async function sendTestEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',           // ✅ Resend's starter email address
      to: 'thaidiberry@gmail.com',              // ✅ Your real email
      subject: 'Hello World from Resend',
      html: '<p>Congrats on sending your <strong>first email</strong> with Resend!</p>'
    });

    if (error) {
      console.error('❌ Error sending email:', error);
    } else {
      console.log('✅ Email sent successfully:', data);
    }
  } catch (err) {
    console.error('❌ Failed:', err);
  }
}

// 3. Call the function
sendTestEmail();

