import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.pathname;
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg">
              <AlertTriangle size={32} />
            </div>

            <h2 className="text-xl font-black text-white mb-2">
              Ups, Terjadi Gangguan Sementara!
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Aplikasi mengalami kendala sinkronisasi langkah. Klik tombol di bawah untuk memuat ulang permainan secara aman.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCcw size={16} />
                <span>Muat Ulang Halaman</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-2 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Home size={14} />
                <span>Kembali ke Beranda Utama</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
