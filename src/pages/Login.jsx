import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; 
import { useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import logo from '../assets/logo-snd.jpg';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      const token = await res.user.getIdToken();
      sessionStorage.setItem('token', token);
      navigate('/dashboard'); 
    } catch (err) {
      setError('Email/Password salah bos!');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "#FED8B1" }}>

      <div className="w-full max-w-sm">

      {/* Logo */}
<div className="text-center mb-8">
<img 
  src={logo} 
  alt="S&D Project" 
  className="mx-auto mb-4"
  style={{ 
    width: "80px", 
    height: "80px", 
    objectFit: "cover",
    borderRadius: "50%"
  }}
/>
  <h1 className="text-3xl font-bold" style={{ color: "#6F4E37" }}>RekapIn</h1>
  <p className="text-sm mt-1" style={{ color: "#A67B5B" }}>
    Sistem Rekap Absensi & Penggajian S&D Project
  </p>
</div>  

        {/* Form Card */}
        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-sm p-8">
          <h2 className="text-lg font-bold mb-6" style={{ color: "#6F4E37" }}>
            Masuk ke Akun Anda
          </h2>

          {error && (
            <p className="text-sm mb-4 px-4 py-3 rounded-lg"
              style={{ backgroundColor: "#F8D7DA", color: "#842029" }}>
              {error}
            </p>
          )}

          <input
            type="email"
            placeholder="Email"
            className="w-full p-2.5 mb-4 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-2.5 mb-6 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #ECB176", color: "#6F4E37" }}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            className="w-full py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "#6F4E37", color: "#FED8B1" }}
          >
            MASUK
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "#A67B5B" }}>
          S&D Project © 2026 · RekapIn
        </p>

      </div>
    </div>
  );
};

export default Login;