import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import Discover, { TrendingRedirect } from './pages/Discover';
import Search from './pages/Search';
import Artists from './pages/Artists';
import ArtistProfile from './pages/ArtistProfile';
import SongPage from './pages/SongPage';
import Districts from './pages/Districts';
import District from './pages/District';
import Join from './pages/Join';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import Account from './pages/Account';
import ForArtists from './pages/ForArtists';
import NotFound from './pages/NotFound';
import StudioLayout from './pages/studio/StudioLayout';
import StudioHome from './pages/studio/StudioHome';
import StudioUpload from './pages/studio/StudioUpload';
import StudioSongs from './pages/studio/StudioSongs';
import StudioSongEdit from './pages/studio/StudioSongEdit';
import StudioAnalytics from './pages/studio/StudioAnalytics';
import StudioProfile from './pages/studio/StudioProfile';
import StudioNotifications from './pages/studio/StudioNotifications';
import ReportSong from './pages/ReportSong';
import AdminLayout from './pages/admin/AdminLayout';
import AdminHome from './pages/admin/AdminHome';
import AdminArtists, { AdminArtistDetail } from './pages/admin/AdminArtists';
import AdminMusic, { AdminSongDetail } from './pages/admin/AdminMusic';
import AdminListeners from './pages/admin/AdminListeners';
import { AdminDistricts, AdminGenres } from './pages/admin/AdminReference';
import { AdminContentReports, AdminCopyright } from './pages/admin/AdminReports';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAccounts from './pages/admin/AdminAccounts';
import AdminAudit from './pages/admin/AdminAudit';

export default function App() {
  return (
    <Routes>
      {/* Self-contained Artist Studio Portal */}
      <Route path="studio" element={<StudioLayout />}>
        <Route index element={<StudioHome />} />
        <Route path="upload" element={<StudioUpload />} />
        <Route path="songs" element={<StudioSongs />} />
        <Route path="songs/:id" element={<StudioSongEdit />} />
        <Route path="analytics" element={<StudioAnalytics />} />
        <Route path="profile" element={<StudioProfile />} />
        <Route path="notifications" element={<StudioNotifications />} />
      </Route>

      {/* Self-contained Admin Control Portal */}
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<AdminHome />} />
        <Route path="music" element={<AdminMusic />} />
        <Route path="music/:id" element={<AdminSongDetail />} />
        <Route path="artists" element={<AdminArtists />} />
        <Route path="artists/:id" element={<AdminArtistDetail />} />
        <Route path="listeners" element={<AdminListeners />} />
        <Route path="reports" element={<AdminContentReports />} />
        <Route path="copyright" element={<AdminCopyright />} />
        <Route path="districts" element={<AdminDistricts />} />
        <Route path="genres" element={<AdminGenres />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="accounts" element={<AdminAccounts />} />
        <Route path="audit" element={<AdminAudit />} />
        <Route path="notifications" element={<StudioNotifications />} />
      </Route>

      {/* Public Consumer Site Layout */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="discover" element={<Discover />} />
        <Route path="trending" element={<TrendingRedirect />} />
        <Route path="search" element={<Search />} />
        <Route path="artists" element={<Artists />} />
        <Route path="artists/:slug" element={<ArtistProfile />} />
        <Route path="songs/:id" element={<SongPage />} />
        <Route path="songs/:id/report" element={<ReportSong />} />
        <Route path="districts" element={<Districts />} />
        <Route path="districts/:slug" element={<District />} />
        <Route path="join" element={<Join />} />
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="verify-email" element={<VerifyEmail />} />
        <Route path="account" element={<Account />} />
        <Route path="upload" element={<ForArtists />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
