const http = require('http');

http.get('http://localhost:3000', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    if (res.statusCode !== 200) {
      console.log('Response:', data.substring(0, 500));
    } else {
      console.log('Success, response length:', data.length);
      if (data.includes('Error')) {
        console.log('Found "Error" in response:', data.substring(data.indexOf('Error') - 50, data.indexOf('Error') + 200));
      }
    }
  });
}).on('error', (err) => {
  console.log('Error:', err.message);
});
