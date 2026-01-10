import { motion } from 'framer-motion';
import { vendors, Vendor } from '@/lib/vendors';

interface VendorLogoProps {
  vendor: Vendor;
  index: number;
}

function VendorLogo({ vendor, index }: VendorLogoProps) {
  return (
    <motion.div
      key={vendor.name}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        delay: index * 0.03,
        duration: 0.4,
        type: 'spring',
        stiffness: 200,
      }}
      whileHover={{
        scale: 1.1,
        y: -4,
      }}
      className="relative group"
    >
      <motion.div
        className="flex h-16 items-center justify-center rounded-lg p-2 transition-all duration-300"
        whileHover={{
          boxShadow: '0 8px 20px -4px rgba(0,0,0,0.1)',
        }}
      >
        <img
          src={vendor.logo}
          alt={vendor.displayName}
          className="h-10 w-auto mx-auto"
        />
      </motion.div>
    </motion.div>
  );
}

interface VendorLogosProps {
  limit?: number;
  totalVendors?: number;
}

export default function VendorLogos({ limit, totalVendors }: VendorLogosProps) {
  const displayVendors = limit ? vendors.slice(0, limit) : vendors;
  const totalCount = totalVendors || vendors.length;

  return (
    <div className="grid grid-cols-3 gap-6 md:grid-cols-4 lg:grid-cols-6">
      {displayVendors.map((vendor, index) => (
        <VendorLogo key={vendor.name} vendor={vendor} index={index} />
      ))}
      {limit && vendors.length > limit && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{
            delay: limit * 0.03,
            duration: 0.5,
            type: 'spring',
            stiffness: 200,
          }}
          className="flex h-16 items-center justify-center rounded-lg bg-muted/50 border border-dashed border-border/50"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-muted-foreground">
              {totalCount}+
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              更多供应商
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
