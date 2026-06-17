module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>NutriLens API Swagger UI</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
      <style>
        html { box-sizing: border-box; overflow: -y-scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin: 0; background: #0f172a; font-family: sans-serif; }
        
        /* Custom styles to match the dark theme aesthetic */
        .swagger-ui {
          filter: invert(0.9) hue-rotate(155deg);
        }
        .swagger-ui .topbar {
          display: none; /* Hide topbar */
        }
        .swagger-ui .info {
          margin: 40px 0;
        }
        .swagger-ui .info .title {
          color: #10b981;
        }
        .swagger-ui .info p, .swagger-ui .info li, .swagger-ui .info table {
          color: #f8fafc;
        }
        
        /* Dark Theme Container Wrapper to prevent double inversion on images or specific parts */
        #swagger-wrapper {
          background-color: #0f172a;
          min-height: 100vh;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <div id="swagger-wrapper">
        <div id="swagger-ui"></div>
      </div>
      <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/api/swagger.json',
            dom_id: '#swagger-ui',
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout",
            deepLinking: true,
            defaultModelsExpandDepth: 1,
            defaultModelExpandDepth: 1
          });
        };
      </script>
    </body>
    </html>
  `;

  return res.status(200).send(htmlContent);
};
