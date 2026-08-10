'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  ListOrdered,
  Users,
  Settings
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'POS Kasir', href: '/transactions/new', icon: ShoppingCart },
  { name: 'Products', href: '/products', icon: Package },
  { name: 'Import Data', href: '/imports', icon: ListOrdered },
  { name: 'Purchases (Restock)', href: '/purchases', icon: ListOrdered },
  { name: 'Inventory', href: '/inventory', icon: ListOrdered },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-indigo-600">TokoBerkah BI</h1>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                group flex items-center px-3 py-2 text-sm font-medium rounded-md
                ${isActive 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600'}
              `}
            >
              <item.icon
                className={`
                  mr-3 h-5 w-5 flex-shrink-0
                  ${isActive ? 'text-indigo-600' : 'text-gray-400 group-hover:text-indigo-600'}
                `}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
