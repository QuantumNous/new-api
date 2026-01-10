import { useState } from 'react';
import { PageHeader } from '@/components/organisms/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/atoms/Loading';
import { Key, Plus, Trash2, Fingerprint } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PasskeyItem {
  id: string;
  name: string;
  createdAt: number;
  lastUsed: number | null;
}

export default function Passkey() {
  const { toast } = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [passkeyName, setPasskeyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegisterPasskey = async () => {
    if (!passkeyName.trim()) {
      toast({
        variant: 'destructive',
        title: '注册失败',
        description: '请输入 Passkey 名称',
      });
      return;
    }

    setIsLoading(true);
    try {
      // TODO: 调用注册 Passkey API
      // Step 1: 获取注册选项
      // const options = await userService.registerPasskeyBegin();
      
      // Step 2: 调用 WebAuthn API
      // const credential = await navigator.credentials.create({
      //   publicKey: options
      // });
      
      // Step 3: 完成注册
      // await userService.registerPasskeyFinish({
      //   name: passkeyName,
      //   credential
      // });
      
      // 模拟 API 响应
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newPasskey: PasskeyItem = {
        id: Date.now().toString(),
        name: passkeyName,
        createdAt: Date.now() / 1000,
        lastUsed: null,
      };
      
      setPasskeys([...passkeys, newPasskey]);
      setShowAddDialog(false);
      setPasskeyName('');
      
      toast({
        title: '注册成功',
        description: 'Passkey 已成功注册',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '注册失败',
        description: error.response?.data?.message || '注册失败，请稍后重试',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePasskey = async (id: string) => {
    setIsLoading(true);
    try {
      // TODO: 调用删除 Passkey API
      // await userService.deletePasskey(id);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setPasskeys(passkeys.filter(p => p.id !== id));
      
      toast({
        title: '删除成功',
        description: 'Passkey 已删除',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: '删除失败',
        description: error.response?.data?.message || '删除失败',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const columns: Column<PasskeyItem>[] = [
    {
      key: 'name',
      title: '名称',
      render: (value) => (
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-primary" />
          <span className="font-medium">{value}</span>
        </div>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      render: (value) => formatDateTime(value * 1000),
    },
    {
      key: 'lastUsed',
      title: '最后使用',
      render: (value) => value ? formatDateTime(value * 1000) : '从未使用',
    },
    {
      key: 'actions',
      title: '操作',
      width: '100px',
      render: (_, record) => (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => handleDeletePasskey(record.id)}
          disabled={isLoading}
          data-testid={`delete-passkey-${record.id}`}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          删除
        </Button>
      ),
    },
  ];

  return (
    <div data-testid="passkey-page">
      <PageHeader
        title="Passkey 设置"
        description="使用 Passkey 进行无密码登录"
      />

      <div className="space-y-6">
        {/* Passkey 说明 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>什么是 Passkey？</CardTitle>
                <CardDescription>
                  Passkey 是一种更安全、更便捷的登录方式
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5">1</Badge>
                <span>使用生物识别（指纹、面容）或设备 PIN 进行身份验证</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5">2</Badge>
                <span>无需记忆密码，更加安全可靠</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge variant="outline" className="mt-0.5">3</Badge>
                <span>防止钓鱼攻击和密码泄露</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Passkey 列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>我的 Passkeys</CardTitle>
                <CardDescription>
                  管理您的 Passkey 设备
                </CardDescription>
              </div>
              <Button
                onClick={() => setShowAddDialog(true)}
                data-testid="add-passkey-button"
              >
                <Plus className="mr-2 h-4 w-4" />
                添加 Passkey
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={passkeys}
              pagination={false}
              emptyText="暂无 Passkey，点击上方按钮添加"
            />
          </CardContent>
        </Card>
      </div>

      {/* 添加 Passkey 对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent data-testid="add-passkey-dialog">
          <DialogHeader>
            <DialogTitle>添加 Passkey</DialogTitle>
            <DialogDescription>
              为这个 Passkey 设置一个名称，以便识别
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="passkey-name">Passkey 名称</Label>
              <Input
                id="passkey-name"
                placeholder="例如：我的 iPhone"
                value={passkeyName}
                onChange={(e) => setPasskeyName(e.target.value)}
                data-testid="passkey-name-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleRegisterPasskey}
              disabled={isLoading || !passkeyName.trim()}
              data-testid="register-passkey-button"
            >
              {isLoading && <LoadingSpinner className="mr-2" />}
              注册
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
