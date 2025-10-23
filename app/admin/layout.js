
import Navbar from '../components/Navbar';

export default function AdminLayout({ children }) {
  return (
    <div>
      <Navbar />
      <main>{children}</main>
    </div>
  );
}
