import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-root error boundary (HARD-03).
 *
 * Catches render errors in any descendant component tree and shows a recovery
 * UI with Retry and Go-home actions. Logs the error to console with full
 * stack and component-stack info.
 *
 * NOTE: A class component is required — React's hooks API does not support
 * the error-boundary lifecycle (getDerivedStateFromError + componentDidCatch).
 * Functional alternatives require the third-party `react-error-boundary`
 * library which we deliberately avoid (no new deps for v1.2 hardening).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Future enhancement: forward to telemetry. For now console is sufficient
    // since we have no telemetry pipeline.
    console.error(
      "[ErrorBoundary] Caught render error:",
      error,
      "\nComponent stack:",
      info.componentStack,
    );
  }

  render() {
    if (this.state.hasError) {
      return <ErrorRecoveryUI error={this.state.error} />;
    }
    return this.props.children;
  }
}

function ErrorRecoveryUI({ error }: { error: Error | null }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold mb-2">
          {t("Something went wrong")}
        </h1>
        <p className="text-muted-foreground mb-4 text-sm">
          {t("The page hit an error. You can try reloading or go back to the home page.")}
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => window.location.reload()}>
            {t("Retry")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            {t("Go home")}
          </Button>
        </div>
        {error && (
          <details className="mt-4 text-xs text-muted-foreground text-left">
            <summary className="cursor-pointer">
              {t("Technical details")}
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded overflow-auto whitespace-pre-wrap break-words">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
