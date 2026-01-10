import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Rocket, Github, Twitter } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export function PageFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Rocket className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">{APP_NAME}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              现代化的 AI 统一平台，为您提供最佳的 API 体验
            </p>
            <div className="flex gap-2">
              <motion.div
                className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer"
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <Github className="h-5 w-5 text-primary" />
              </motion.div>
              <motion.div
                className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors cursor-pointer"
                whileHover={{ scale: 1.1, rotate: -5 }}
              >
                <Twitter className="h-5 w-5 text-primary" />
              </motion.div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">产品</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/models" className="text-muted-foreground hover:text-primary transition-colors">
                  模型库
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-muted-foreground hover:text-primary transition-colors">
                  定价
                </Link>
              </li>
              <li>
                <Link to="/docs" className="text-muted-foreground hover:text-primary transition-colors">
                  文档
                </Link>
              </li>
              <li>
                <Link to="/playground/chat" className="text-muted-foreground hover:text-primary transition-colors">
                  操练场
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">支持</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/docs" className="text-muted-foreground hover:text-primary transition-colors">
                  帮助中心
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                  关于我们
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                  联系我们
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">法律</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/terms" className="text-muted-foreground hover:text-primary transition-colors">
                  服务条款
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  隐私政策
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2025 {APP_NAME}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
