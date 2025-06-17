const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const fetch = require('node-fetch');
global.fetch = fetch;
global.Headers = fetch.Headers;

const { Resend } = require('resend');

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// sendVerificationEmail function
exports.sendVerificationEmail = async (email, name, url) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,   // Example: onboarding@resend.dev
      to: email,
      subject: "Confirm Your iHighlight Account",
      html: `
        <div style="max-width:700px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;font-family:Roboto;font-weight:600;color:#000000">
          <img src="https://res.cloudinary.com/dx8ht3lz4/image/upload/t_ihighlight%20_icon_64x64/v1726102675/ihighlight_logo_short_owb4vm.png" alt="" style="width:30px">
          <span style="margin-top:5px;">Action Required: Activate Your iHighlight Account</span>
        </div>
        <div style="padding:1rem 0;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;color:#141823;font-size:17px;font-family:Roboto">
          <span>Hello ${name},</span>
          <div style="padding:20px 0">
            <span style="padding:1.5rem 0">
              You recently created an account on iHighlight. To complete your registration, please confirm your account.
            </span>
          </div>
          <a href="${url}" style="width:200px;padding:10px 15px;background:#000000;color:#fff;text-decoration:none;font-weight:600">
            Confirm Your Account
          </a>
          <div style="padding-top:20px">
            <span style="margin:1.5rem 0;color:#898f9c">
              iHighlight allows you to highlight and save text from the web. Create a community on any topic and more.
            </span>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("❌ sendVerificationEmail Error:", error);
      return error;
    }

    console.log("✅ Verification email sent:", data);
    return data;
  } catch (err) {
    console.error("❌ sendVerificationEmail Failed:", err);
    return err;
  }
};

// sendResetCode function
exports.sendResetCode = async (email, name, code) => {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: email,
      subject: "Reset iHighlight Password",
      html: `
         <div style="max-width:700px;margin-bottom:1rem;display:flex;align-items:center;gap:10px;font-family:Roboto;font-weight:600;color:#000000">
          <img src="https://res.cloudinary.com/dx8ht3lz4/image/upload/t_ihighlight%20_icon_64x64/v1726102675/ihighlight_logo_short_owb4vm.png" alt="" style="width:30px">
          <span style="margin-top:5px;">Action Required: Reset Your Password for Your iHighlight Account</span>
        </div>
        <div style="padding:1rem 0;border-top:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5;color:#141823;font-size:17px;font-family:Roboto">
          <span>Hello ${name},</span>
          <div style="padding:20px 0">
            <span style="padding:1.5rem 0">
              We received a request to reset your password. Use the code below:
            </span>
          </div>
          <div style="width:200px;padding:10px 15px;background:#000000;color:#fff;text-decoration:none;font-weight:600;text-align:center">
            ${code}
          </div>
          <div style="padding-top:20px">
            <span style="margin:1.5rem 0;color:#898f9c">
              If you didn’t request a password reset, please ignore this email.
            </span>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error("❌ sendResetCode Error:", error);
      return error;
    }

    console.log("✅ Reset code email sent:", data);
    return data;
  } catch (err) {
    console.error("❌ sendResetCode Failed:", err);
    return err;
  }
};
