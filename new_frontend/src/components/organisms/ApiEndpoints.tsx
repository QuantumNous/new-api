import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_ENDPOINTS } from '@/constants/api-docs';

export function ApiEndpoints() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>主要 API 端点</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {API_ENDPOINTS.map((endpoint, index) => (
            <div key={index} className={`border-l-4 ${endpoint.color} pl-4`}>
              <h4 className="font-semibold">{endpoint.method} {endpoint.path}</h4>
              <p className="text-sm text-muted-foreground">{endpoint.description}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
