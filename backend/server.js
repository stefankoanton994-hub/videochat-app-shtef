const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>VideoChat - Тест</title>
        <style>
            body { font-family: Arial; padding: 40px; text-align: center; }
            .success { color: green; }
        </style>
    </head>
    <body>
        <h1 class="success">✅ Сервер работает!</h1>
        <p>VideoChat приложение запущено успешно</p>
        <p><a href="/api/status">Проверить API</a></p>
    </body>
    </html>
  `);
});

app.get('/api/status', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Сервер работает',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});