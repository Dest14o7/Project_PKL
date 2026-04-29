import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // akses firebase
      const res = await signInWithEmailAndPassword(auth, email, password);
      
      // token
      const token = await res.user.getIdToken();
      
      // ke storage
      localStorage.setItem('token', token);

      
      navigate('/dashboard'); 
    } catch (err) {
      setError('Email/Password salah bos!');
    }
  };``

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Login RekapIn</h2>
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <input 
          type="email" placeholder="Email" className="w-full p-2 mb-4 border rounded"
          onChange={(e) => setEmail(e.target.value)} required 
        />
        <input 
          type="password" placeholder="Password" className="w-full p-2 mb-6 border rounded"
          onChange={(e) => setPassword(e.target.value)} required 
        />
        <button className="w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
          LOGIN
        </button>
      </form>
    </div>
  );
};

export default Login;