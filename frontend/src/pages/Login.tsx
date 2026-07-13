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
        'Error al iniciar sesión. Verifique su conexión.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-slide-up">
        <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[1.15fr_440px]">
          <section className="relative flex flex-col items-center justify-center overflow-hidden bg-brand-navy p-8 text-center sm:p-10">
            <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-brand-ink/70 to-transparent" />
            <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
              <img
                src="/brand/istl-logo-white.png"
                alt="Instituto Superior Tecnológico Loja"
                className="h-36 w-auto object-contain"
              />
              <div className="mt-12">
                <p className="text-xs font-semibold uppercase text-istl-200">Sistema institucional</p>
                <h1 className="mt-3 font-brand text-4xl font-bold leading-none text-white sm:text-5xl">
                  <span className="block">Asistencia Virtual</span>
                  <span className="mt-2 block">Docente</span>
                </h1>
                <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-slate-200 sm:text-base">
                  Registro académico para clases virtuales, control de horarios, geolocalización autorizada y reportes institucionales.
                </p>
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center p-7 sm:p-9">
            <div className="mb-8">
              <img
                src="/brand/istl-logo-horizontal.png"
                alt="Instituto Superior Tecnológico Loja"
                className="h-14 w-auto object-contain object-left"
              />
              <h2 className="mt-7 font-brand text-2xl font-bold text-brand-navy">Ingreso al sistema</h2>
              <p className="mt-1 text-sm text-slate-500">Use sus credenciales institucionales.</p>
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
                    className="w-full py-3 pl-10 pr-4"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Contraseña
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
                    className="w-full py-3 pl-10 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-brand-navy transition-colors"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
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
                className="btn-primary flex w-full items-center justify-center gap-2 py-3.5 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Verificando credenciales...' : 'Iniciar sesión'}
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
                className="btn-secondary mt-4 flex w-full items-center justify-center gap-2 py-3"
              >
                <span className="font-bold text-blue-600">G</span>
                Google institucional
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-200 text-center">
              <p className="text-slate-500 text-xs">
                Use su correo <span className="text-brand-navy font-medium">@tecnologicoloja.edu.ec</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
