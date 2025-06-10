import React, { useEffect, useState } from 'react';

function App() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('http://localhost:8080')
      .then(res => res.text())
      .then(text => setMessage(text))
      .catch(err => setMessage('Error fetching from backend'));
  }, []);

  return (
    <div style={{padding: '20px', fontFamily: 'Arial'}}>
      <h1>React Frontend</h1>
      <p>Message from backend: {message}</p>
    </div>
  );
}

export default App;