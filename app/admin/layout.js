
import Navbar from '../components/Navbar';

export default function AdminLayout({ children }) {
  return (
    <div>
      <Navbar />
      <main style={{ padding: 0 }}>{children}</main>
    </div>
  );
}
