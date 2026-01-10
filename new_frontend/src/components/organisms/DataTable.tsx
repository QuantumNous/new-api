import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Empty } from '@/components/atoms/Empty';
import { Loading } from '@/components/atoms/Loading';
import { Pagination } from '@/components/molecules/Pagination';
import { cn } from '@/lib/utils';

export interface Column<T> {
  key: string;
  title: string;
  width?: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey?: keyof T | ((record: T) => string | number);
  selectable?: boolean;
  selectedKeys?: (string | number)[];
  onSelectChange?: (keys: (string | number)[]) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  emptyText?: string;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  rowKey = 'id',
  selectable = false,
  selectedKeys = [],
  onSelectChange,
  pagination,
  emptyText = '暂无数据',
  className,
}: DataTableProps<T>) {
  const getRowKey = (record: T): string | number => {
    if (typeof rowKey === 'function') {
      return rowKey(record);
    }
    return record[rowKey];
  };

  const isAllSelected =
    data.length > 0 && data.every((record) => selectedKeys.includes(getRowKey(record)));

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectChange?.(data.map(getRowKey));
    } else {
      onSelectChange?.([]);
    }
  };

  const handleSelectRow = (record: T, checked: boolean) => {
    const key = getRowKey(record);
    if (checked) {
      onSelectChange?.([...selectedKeys, key]);
    } else {
      onSelectChange?.(selectedKeys.filter((k) => k !== key));
    }
  };

  if (loading) {
    return (
      <div className="py-12">
        <Loading />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <Empty title={emptyText} />;
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                >
                  {column.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((record, index) => {
              const key = getRowKey(record);
              const isSelected = selectedKeys.includes(key);

              return (
                <TableRow key={key}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          handleSelectRow(record, checked as boolean)
                        }
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        column.align === 'center' && 'text-center',
                        column.align === 'right' && 'text-right'
                      )}
                    >
                      {column.render
                        ? column.render(record[column.key], record, index)
                        : record[column.key]}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      )}
    </div>
  );
}
