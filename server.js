const express = require('express');
const app = express();

app.set('port', (process.env.PORT || 5000));

app.post('/', (request, response) => {
    console.ingo('Got request', request);
    response.end();
});

app.listen(app.get('port'), () => {
    console.log('Node app is running on port', app.get('port'));
});
