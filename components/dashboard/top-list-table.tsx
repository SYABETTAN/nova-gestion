import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDashboardCurrency } from "@/lib/dashboard-formatters";

type Row = { id: string; name: string; amount: number };

export function TopListTable({
  title,
  rows,
  emptyMessage = "Aucune donnée",
}: {
  title: string;
  rows: Row[];
  emptyMessage?: string;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-[var(--color-muted-foreground)]">{emptyMessage}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className="text-right">Montant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell>
                  <span className="text-muted-foreground mr-2 text-xs">{i + 1}.</span>
                  {row.name}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatDashboardCurrency(row.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
