import { useState, useEffect } from 'react';

export default function FeatureAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 检查是否已经显示过
    const hasShown = localStorage.getItem('featureAnnouncementShown');
    if (!hasShown) {
      // 延迟2秒后显示，让页面先加载完成
      const timer = setTimeout(() => {
        setVisible(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem('featureAnnouncementShown', 'true');
  };

  if (!visible) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const mobileStyle = isMobile ? {
    maxWidth: '150px',
    fontSize: '10px',
    padding: '8px'
  } : {};

  return (
    <div className="absolute top-20 right-8 bg-white rounded-lg p-4 max-w-xs shadow-xl z-50 border border-gray-200" style={mobileStyle}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-base font-semibold text-gray-600">Feature Updates</h3>
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-600 text-lg"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-sm text-gray-600">
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Australia & the Americas: Live</strong></li>
          <li><strong>Europe & Asia: Beta (major countries & cities)</strong></li>
          <li>Rolling out new locations weekly</li>
        </ul>
      </div>
    </div>
  );
} 