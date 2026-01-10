import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Group {
  id: string;
  name: string;
  description: string;
  userCount: number;
}

export default function GroupList() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([
    { id: '1', name: 'default', description: '默认分组', userCount: 10 },
    { id: '2', name: 'vip', description: 'VIP 用户', userCount: 5 },
  ]);
  const [showDialog, setShowDialog] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  const handleCreateGroup = () => {
    if (!groupName.trim()) {
      toast({
        variant: 'destructive',
        title: '创建失败',
        description: '请输入分组名称',
      });
      return;
    }

    const newGroup: Group = {
      id: Date.now().toString(),
      name: groupName,
      description: groupDescription,
      userCount: 0,
    };

    setGroups([...groups, newGroup]);
    setShowDialog(false);
    setGroupName('');
    setGroupDescription('');

    toast({
      title: '创建成功',
      description: '分组已创建',
    });
  };

  const handleDeleteGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
    toast({
      title: '删除成功',
      description: '分组已删除',
    });
  };

  const columns: Column<Group>[] = [
    {
      key: 'name',
      title: '分组名称',
      render: (value) => <span className="font-medium">{value}</span>,
    },
    {
      key: 'description',
      title: '描述',
    },
    {
      key: 'userCount',
      title: '用户数',
    },
    {
      key: 'actions',
      title: '操作',
      width: '150px',
      render: (_, record) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid={`edit-group-${record.id}`}
          >
            <Edit className="mr-1 h-3 w-3" />
            编辑
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeleteGroup(record.id)}
            data-testid={`delete-group-${record.id}`}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div data-testid="group-list-page">
      <PageHeader
        title="分组管理"
        description="管理用户分组和权限"
        actions={
          <Button
            onClick={() => setShowDialog(true)}
            data-testid="create-group-button"
          >
            <Plus className="mr-2 h-4 w-4" />
            创建分组
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>用户分组</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={groups}
            pagination={false}
            emptyText="暂无分组数据"
          />
        </CardContent>
      </Card>

      {/* 创建分组对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent data-testid="create-group-dialog">
          <DialogHeader>
            <DialogTitle>创建分组</DialogTitle>
            <DialogDescription>
              创建新的用户分组
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">分组名称</Label>
              <Input
                id="group-name"
                placeholder="请输入分组名称"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                data-testid="group-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="group-description">描述</Label>
              <Input
                id="group-description"
                placeholder="请输入描述"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                data-testid="group-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateGroup}
              data-testid="confirm-create-button"
            >
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
