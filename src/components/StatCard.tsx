import { type ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: number | string | ReactNode;
  icon?: ReactNode;
}

export default function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        {icon && <div className="text-gray-300">{icon}</div>}
      </div>
    </div>
  );
}
