// src/pages/Login.jsx
import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore'; // Importação nova
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      // 1. Faz Login no Firebase Auth
      await signInWithEmailAndPassword(auth, email, senha);
      
      // 2. Busca as Permissões no Firestore
      const userRef = doc(db, "usuarios_permissoes", email.toLowerCase().trim());
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // Salva os dados do usuário na memória local para usar no painel
        const dadosUsuario = userSnap.data();
        localStorage.setItem('fotus_user', JSON.stringify(dadosUsuario));
        navigate('/admin');
      } else {
        // Se não tiver permissão cadastrada, cria um "Admin Provisório" se for você (opcional)
        // ou barra o acesso.
        // Para facilitar seu primeiro acesso, vamos permitir, mas com perfil limitado:
        const perfilProvisorio = { nome: "Usuário", filial: "TODAS", cargo: "Operador", email: email };
        localStorage.setItem('fotus_user', JSON.stringify(perfilProvisorio));
        navigate('/admin');
      }

    } catch (error) {
      setErro("Acesso negado. Verifique e-mail e senha.");
      console.error(error);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="logo-area">
            <h1 className="fotus-logo">FOTUS</h1>
            <p className="fotus-sub">Torre de Controle Logístico</p>
        </div>
        
        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label>E-mail Corporativo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu.nome@fotus.com.br" required />
          </div>
          <div className="input-group">
            <label>Senha</label>
            <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="••••••••" required />
          </div>
          {erro && <p className="error-msg">{erro}</p>}
          <button type="submit" className="btn-entrar">ACESSAR SISTEMA</button>
        </form>
      </div>
      <style>{`
        .login-container { height: 100vh; background: linear-gradient(135deg, #002B49 0%, #001a2e 100%); display: flex; align-items: center; justify-content: center; font-family: 'Segoe UI', sans-serif; }
        .login-card { background: white; padding: 40px; border-radius: 8px; width: 100%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border-top: 5px solid #F4A900; }
        .logo-area { text-align: center; margin-bottom: 30px; }
        .fotus-logo { margin: 0; color: #002B49; font-size: 2.5rem; letter-spacing: 2px; font-weight: 900; }
        .fotus-sub { margin: 5px 0 0; color: #666; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }
        .input-group { margin-bottom: 20px; }
        .input-group label { display: block; margin-bottom: 8px; color: #333; font-weight: 600; font-size: 0.9rem; }
        .input-group input { width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
        .btn-entrar { width: 100%; padding: 14px; background-color: #002B49; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: bold; cursor: pointer; margin-top: 10px; }
        .btn-entrar:hover { background-color: #00406b; }
        .error-msg { color: #dc3545; font-size: 0.9rem; text-align: center; margin-top: -10px; margin-bottom: 15px; }
      `}</style>
    </div>
  );
}