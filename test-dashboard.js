fetch('https://lifesucks.meomeow.qzz.io/v/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'mrs', password: '@dmin' }) })
  .then(r => r.json())
  .then(data => {
    const token = data.access_token;
    return fetch('https://lifesucks.meomeow.qzz.io/dashboard?bypass=123', {
      headers: { 'Cookie': `stoken=${token}` }
    });
  })
  .then(r => r.text())
  .then(console.log);
