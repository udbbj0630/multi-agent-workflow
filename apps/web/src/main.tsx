import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ChildChat } from './pages/child/Chat';
import { ParentDashboard } from './pages/parent/Dashboard';

const App = () => (
  <BrowserRouter>
    <Routes>
      {/* 孩子端 */}
      <Route path="/" element={<ChildChat />} />
      <Route path="/chat" element={<ChildChat />} />

      {/* 家长端 */}
      <Route path="/parent" element={<ParentDashboard />} />
      <Route path="/parent/growth" element={<div>成长详情（开发中）</div>} />
      <Route path="/parent/reports" element={<div>报告（开发中）</div>} />
    </Routes>
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
