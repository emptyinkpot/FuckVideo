// FuckVideo.exe — double-click launcher for the FuckVideo workbench.
//
// - If VideoLab (http://127.0.0.1:3037) is already up, just opens its window.
// - Otherwise starts `node videolab/server/start.mjs` hidden (no console window; it runs
//   the VideoLab server and the stock Remotion Studio), logs to out\launcher.log, shows a
//   small "starting" window, and opens VideoLab once it answers. The launcher then exits.
// - VideoLab opens as a standalone window (Edge app mode: no tabs, no address bar, own
//   taskbar icon). Falls back to the default browser if Edge is missing.
// - Shutting down is done from VideoLab: the "关闭" button calls POST /api/shutdown,
//   which kills the whole node process tree.
//
// Build: launcher\build.cmd (uses the C# compiler bundled with .NET Framework 4.x).
// The exe must sit in the FuckVideo repo root; it locates everything relative to itself.

using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Threading;
using System.Windows.Forms;

static class FuckVideoLauncher
{
    const string WorkbenchUrl = "http://127.0.0.1:3037/";
    const int StartupTimeoutSeconds = 180;

    [STAThread]
    static int Main(string[] args)
    {
        bool openBrowser = Array.IndexOf(args, "--no-browser") < 0;
        string root = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\');

        if (IsUp(WorkbenchUrl))
        {
            if (openBrowser) Open(WorkbenchUrl);
            return 0;
        }

        string entry = Path.Combine(root, "videolab", "server", "start.mjs");
        if (!File.Exists(entry))
        {
            Fail("找不到 " + entry + "\n\nFuckVideo.exe 必须放在 FuckVideo 项目根目录里。");
            return 1;
        }

        string node = FindNode(root);
        if (node == null)
        {
            Fail("找不到 Node.js（node.exe）。\n\n需要安装 Node.js 18 或更新版本。");
            return 1;
        }

        string outDir = Path.Combine(root, "out");
        Directory.CreateDirectory(outDir);
        string log = Path.Combine(outDir, "launcher.log");

        // cmd only does the log redirection; node keeps running after this exe exits.
        var psi = new ProcessStartInfo("cmd.exe",
            "/d /c \"\"" + node + "\" \"" + entry + "\" > \"" + log + "\" 2>&1\"");
        psi.WorkingDirectory = root;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        Process proc;
        try
        {
            proc = Process.Start(psi);
        }
        catch (Exception e)
        {
            Fail("启动失败：" + e.Message);
            return 1;
        }

        bool ready = WaitWithSplash(proc);
        if (!ready)
        {
            Fail("工作台在 " + StartupTimeoutSeconds + " 秒内没有启动成功。\n\n日志：" + log);
            return 1;
        }
        if (openBrowser) Open(WorkbenchUrl);
        return 0;
    }

    static bool WaitWithSplash(Process proc)
    {
        var form = new Form();
        form.Text = "FuckVideo";
        form.FormBorderStyle = FormBorderStyle.FixedDialog;
        form.MaximizeBox = false;
        form.MinimizeBox = false;
        form.StartPosition = FormStartPosition.CenterScreen;
        form.ClientSize = new Size(340, 90);
        form.BackColor = Color.FromArgb(11, 13, 18);
        form.ShowInTaskbar = true;
        var label = new Label();
        label.Dock = DockStyle.Fill;
        label.TextAlign = ContentAlignment.MiddleCenter;
        label.ForeColor = Color.FromArgb(229, 231, 235);
        label.Font = new Font("Microsoft YaHei UI", 11f);
        label.Text = "正在启动 FuckVideo 工作台…";
        form.Controls.Add(label);

        bool ready = false;
        var started = DateTime.Now;
        var timer = new System.Windows.Forms.Timer();
        timer.Interval = 1000;
        timer.Tick += delegate
        {
            int secs = (int)(DateTime.Now - started).TotalSeconds;
            label.Text = "正在启动 FuckVideo 工作台… " + secs + "s";
            if (proc.HasExited || secs > StartupTimeoutSeconds)
            {
                timer.Stop();
                form.Close();
                return;
            }
            ThreadPool.QueueUserWorkItem(delegate
            {
                if (IsUp(WorkbenchUrl))
                {
                    ready = true;
                    form.BeginInvoke((MethodInvoker)delegate { timer.Stop(); form.Close(); });
                }
            });
        };
        timer.Start();
        Application.Run(form);
        return ready;
    }

    static bool IsUp(string url)
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(url);
            req.Timeout = 900;
            req.Proxy = null;
            using (var resp = (HttpWebResponse)req.GetResponse())
            {
                return (int)resp.StatusCode < 500;
            }
        }
        catch (WebException e)
        {
            var resp = e.Response as HttpWebResponse;
            return resp != null && (int)resp.StatusCode < 500;
        }
        catch
        {
            return false;
        }
    }

    static string FindNode(string root)
    {
        string path = Environment.GetEnvironmentVariable("PATH") ?? "";
        foreach (string dir in path.Split(';'))
        {
            if (dir.Trim().Length == 0) continue;
            try
            {
                string candidate = Path.Combine(dir.Trim().Trim('"'), "node.exe");
                if (File.Exists(candidate)) return candidate;
            }
            catch { }
        }
        string[] fallbacks = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "nodejs\\node.exe"),
            Path.Combine(root, "platform\\.runtime\\node-v22.23.0-win-x64\\node.exe"),
        };
        foreach (string f in fallbacks)
        {
            if (File.Exists(f)) return f;
        }
        return null;
    }

    static void Open(string url)
    {
        string edge = FindEdge();
        if (edge != null)
        {
            try
            {
                Process.Start(new ProcessStartInfo(edge, "--app=" + url + " --window-size=1600,940") { UseShellExecute = false });
                return;
            }
            catch { }
        }
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    static string FindEdge()
    {
        string[] candidates = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
        };
        foreach (string c in candidates)
        {
            if (File.Exists(c)) return c;
        }
        return null;
    }

    static void Fail(string message)
    {
        MessageBox.Show(message, "FuckVideo", MessageBoxButtons.OK, MessageBoxIcon.Error);
    }
}
