import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  readonly children: ReactNode;
}

interface State {
  readonly failed: boolean;
}

/**
 * Last line of defence: a render error, or a file that fails to load (offline after an update),
 * shows a way out instead of a blank page. Progress is saved already, so a reload loses nothing.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main
        role="alert"
        className="grid h-dvh place-items-center bg-slate-950 p-6 text-center text-slate-200"
      >
        <div className="max-w-sm rounded-3xl p-8 hud-card">
          <h1 className="text-2xl font-black text-strong">
            Something went wrong
          </h1>
          <p className="mt-2 text-slate-300">
            Your progress is saved. Reload to carry on.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 w-full rounded-2xl bg-teal-300 py-3 font-bold text-ink active:scale-[0.97]"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
