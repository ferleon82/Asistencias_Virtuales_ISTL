import { FormEvent, useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL ?? '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');

    if (accessToken && refreshToken) {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      window.location.replace('/dashboard');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get('error');
    if (googleError) setError(googleError);
  }, []);

  if (!isLoading && isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error al iniciar sesion. Verifique su conexion.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-2xl border border-slate-200 animate-slide-up">
        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[1fr_420px]">
          <section className="bg-brand-navy p-8 sm:p-10 flex flex-col justify-between">
            <div>
              <img
                src="/brand/istl-logo-white.png"
                alt="Instituto Superior Tecnologico Loja"
                className="h-28 w-auto object-contain object-left"
              />
              <div className="mt-10 max-w-xl">
                <p className="font-brand text-sm uppercase text-istl-200">Sistema Institucional</p>
                <h1 className="font-brand text-4xl sm:text-5xl font-bold text-white mt-3 leading-tight">
                  Asistencia Virtual Docente
                </h1>
                <p className="mt-4 text-sm leading-6 text-slate-200">
                  Registro academico para clases virtuales, control de horarios y seguimiento operativo docente.
                </p>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-5">
              <span className="h-2 w-16 bg-brand-teal" />
              <p className="text-xs uppercase text-slate-300">Define tu futuro</p>
            </div>
          </section>

          <section className="p-7 sm:p-9 flex flex-col justify-center">
            <div className="mb-8">
              <img
                src="/brand/istl-logo-horizontal.png"
                alt="Instituto Superior Tecnologico Loja"
                className="h-14 w-auto object-contain object-left"
              />
              <h2 className="font-brand text-2xl font-bold text-brand-navy mt-7">Ingreso al sistema</h2>
              <p className="text-sm text-slate-500 mt-1">Use sus credenciales institucionales.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Correo institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4.5 h-4.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z" />
                      <path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="nombre@tecnologicoloja.edu.ec"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 rounded-md bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contrasena
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <svg className="w-4.5 h-4.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0 1 10 0v2a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2Zm8-2v2H7V7a3 3 0 0 1 6 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="********"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-12 py-3 rounded-md bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent transition-all text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-brand-navy transition-colors"
                    aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                  >
                    <svg className="w-4.5 h-4.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      <path
                        fillRule="evenodd"
                        d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-md bg-red-50 border border-red-200 animate-fade-in">
                  <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !email || !password}
                id="btn-login"
                className="w-full py-3.5 px-6 rounded-md bg-brand-navy hover:bg-brand-ink disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-slate-300 flex items-center justify-center gap-2"
              >
                {isSubmitting ? 'Verificando credenciales...' : 'Iniciar sesion'}
              </button>
            </form>

            <div className="mt-5">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-2 text-slate-500">o ingrese con su cuenta institucional</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.location.href = `${API_URL}/api/v1/auth/google`;
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <span className="font-bold text-blue-600">G</span>
                Google institucional
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center">
              <p className="text-slate-500 text-xs">
                Use su correo <span className="text-brand-navy font-medium">@tecnologicoloja.edu.ec</span>
              </p>
              <p className="text-slate-400 text-xs mt-1">Dependencia: Ministerio de Educacion del Ecuador</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
