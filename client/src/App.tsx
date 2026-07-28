import { lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Spinner from "./components/spinner";

const Main = lazy(() => import("./layout/layout"));
const LoginPage = lazy(() => import("./pages/login/index"));
const ResetPasswordPage = lazy(() => import("./pages/login/reset-password"));
const Dashboard = lazy(() => import("./pages/dashboard/index"));
const Clients = lazy(() => import("./pages/clients/index"));
const Rooms = lazy(() => import("./pages/rooms/index"));
const CreateClient = lazy(() => import("./pages/clients/create-client"));
const CreateRoom = lazy(() => import("./pages/rooms/create-room"));
const CreateForm = lazy(() => import("./pages/forms/create-form"));
const ViewForm = lazy(() => import("./pages/forms/view-form"));
const EditForm = lazy(() => import("./pages/forms/edit-form"));
const Forms = lazy(() => import("./pages/forms/index"));
const FormEntry = lazy(() => import("./pages/form-entry/index"));
const CreateFormEntry = lazy(
  () => import("./pages/form-entry/create-form-entry"),
);
const ViewFormEntry = lazy(() => import("./pages/form-entry/view-form-entry"));
const EditFormEntry = lazy(() => import("./pages/form-entry/edit-form-entry"));
const Reports = lazy(() => import("./pages/reports/index"));
const CreateReport = lazy(() => import("./pages/reports/create-report"));
const ViewReport = lazy(() => import("./pages/reports/view-report"));
const UserManagement = lazy(() => import("./pages/user-management/index"));
const CreateUser = lazy(() => import("./pages/user-management/create-user"));
const ViewUser = lazy(() => import("./pages/user-management/view-user"));
const EditUser = lazy(() => import("./pages/user-management/edit-user"));
const GroupManagement = lazy(() => import("./pages/group-management/index"));
const NotAuthorized = lazy(
  () => import("./pages/not-authorized/NotAuthorized"),
);

import { Toaster } from "sonner";
import { usePersistLogin } from "./hooks/userPersistLogin";
import ProtectedRoute from "./components/protected-route";
import RoleProtectedRoute from "./components/RoleProtectedRoute";

const router = createBrowserRouter([
  {
    path: "login",
    element: (
      <Suspense fallback={<Spinner />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "reset-password",
    element: (
      <Suspense fallback={<Spinner />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    // ✅ not-authorized is outside the layout so it shows full screen
    path: "not-authorized",
    element: (
      <Suspense fallback={<Spinner />}>
        <NotAuthorized />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: (
          <Suspense fallback={<Spinner />}>
            <Main />
          </Suspense>
        ),
        children: [
          // ✅ Wrap all role-protected routes inside RoleProtectedRoute
          {
            element: <RoleProtectedRoute />,
            children: [
              {
                index: true,
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Dashboard />
                  </Suspense>
                ),
              },
              {
                path: "dashboard",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Dashboard />
                  </Suspense>
                ),
              },
              {
                path: "forms",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Forms />
                  </Suspense>
                ),
              },
              {
                path: "forms/view/:formId",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <ViewForm />
                  </Suspense>
                ),
              },
              {
                path: "forms/edit/:formId",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <EditForm />
                  </Suspense>
                ),
              },
              {
                path: "forms/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateForm />
                  </Suspense>
                ),
              },
              {
                path: "form-entry",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <FormEntry />
                  </Suspense>
                ),
              },
              {
                path: "form-entry/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateFormEntry />
                  </Suspense>
                ),
              },
              {
                path: "form-entry/view/:entryId",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <ViewFormEntry />
                  </Suspense>
                ),
              },
              {
                path: "form-entry/edit/:entryId",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <EditFormEntry />
                  </Suspense>
                ),
              },
              {
                path: "reports",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Reports />
                  </Suspense>
                ),
              },
              {
                path: "reports/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateReport />
                  </Suspense>
                ),
              },
              {
                path: "reports/view/:reportId",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <ViewReport />
                  </Suspense>
                ),
              },
              {
                path: "clients",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Clients />
                  </Suspense>
                ),
              },
              {
                path: "clients/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateClient />
                  </Suspense>
                ),
              },
              {
                path: "rooms",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <Rooms />
                  </Suspense>
                ),
              },
              {
                path: "rooms/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateRoom />
                  </Suspense>
                ),
              },
              {
                path: "user-management",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <UserManagement />
                  </Suspense>
                ),
              },
              {
                path: "user-management/create",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <CreateUser />
                  </Suspense>
                ),
              },
              {
                path: "user-management/view/:id",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <ViewUser />
                  </Suspense>
                ),
              },
              {
                path: "user-management/edit/:id",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <EditUser />
                  </Suspense>
                ),
              },
              {
                path: "group-management",
                element: (
                  <Suspense fallback={<Spinner />}>
                    <GroupManagement />
                  </Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
]);

function App() {
  return (
    <>
      <AuthWrapper>
        <RouterProvider router={router} />
        <Toaster
          position="top-right"
          theme="light"
          toastOptions={{
            classNames: {
              toast: "bg-white text-gray-800 shadow-lg border border-gray-200",
              success: "bg-white text-gray-800 [&_svg]:text-green-500",
              error: "bg-white text-gray-800 [&_svg]:text-red-500",
            },
          }}
        />
      </AuthWrapper>
    </>
  );
}

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const { loading } = usePersistLogin();
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <Spinner />
      </div>
    );
  }

  return <>{children}</>;
}

export default App;
