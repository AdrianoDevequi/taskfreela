const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('SUCESSO! O Node.js esta rodando corretamente.');
});

server.listen(port, () => {
    console.log(`Server running at port ${port}`);
});
