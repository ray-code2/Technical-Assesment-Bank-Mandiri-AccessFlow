import { Inbox, LoaderCircle } from "lucide-react";

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <LoaderCircle className="spin" size={28} />
      <span>Loading...</span>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Inbox size={24} /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return <div className="alert alert--error" role="alert">{message}</div>;
}

