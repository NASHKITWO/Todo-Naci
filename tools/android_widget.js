'use strict';
/* Widget layar utama (Android native) untuk Todo. Dibuat oleh patch_android.js ke proyek hasil `cap add android`.
 * Alur data: aplikasi web → plugin Capacitor "TodoWidget" (Java) → SharedPreferences → TodoWidgetProvider menggambar widget.
 * Widget menampilkan tugas terlambat + hari ini (maks. 5 baris) dan membuka aplikasi saat diketuk. */

const ROWS = 5;
const nums = Array.from({ length: ROWS }, (_, i) => i + 1);
const idList = prefix => nums.map(n => 'R.id.' + prefix + n).join(', ');

const PROVIDER = `package __PKG__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.text.Spannable;
import android.text.SpannableStringBuilder;
import android.text.style.ForegroundColorSpan;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widget "Hari ini": membaca daftar tugas yang didorong aplikasi (JSON di SharedPreferences).
 * Lingkaran di kiri tiap baris menandai tugas selesai: uid-nya dicatat di KEY_DONE, baris langsung disembunyikan,
 * dan aplikasi menyelesaikan tugasnya saat dibuka berikutnya. Tombol "+" membuka aplikasi pada kolom tambah tugas.
 */
public class TodoWidgetProvider extends AppWidgetProvider {
    static final String PREFS = "todo_widget";
    static final String KEY_ITEMS = "items";
    static final String KEY_DONE = "done_uids";
    static final String ACTION_DONE = "__PKG__.WIDGET_DONE";
    static final String EXTRA_ACTION = "widget_action";
    private static final int MAX_ROWS = ${ROWS};
    private static final int[] LINE_IDS = { ${idList('widget_line')} };
    private static final int[] CHK_IDS = { ${idList('widget_chk')} };
    private static final int[] ROW_IDS = { ${idList('widget_row')} };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        RemoteViews views = build(context);
        for (int id : widgetIds) manager.updateAppWidget(id, views);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_DONE.equals(intent.getAction())) {
            String uid = intent.getStringExtra("uid");
            if (uid != null && !uid.isEmpty()) {
                addPending(context, uid);
                refreshAll(context);
            }
        }
    }

    /** Dipanggil plugin setelah data baru dari aplikasi masuk. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] widgetIds = manager.getAppWidgetIds(new ComponentName(context, TodoWidgetProvider.class));
        if (widgetIds.length == 0) return;
        RemoteViews views = build(context);
        for (int id : widgetIds) manager.updateAppWidget(id, views);
    }

    static synchronized Set<String> pending(Context context) {
        Set<String> out = new HashSet<String>();
        try {
            JSONArray a = new JSONArray(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_DONE, "[]"));
            for (int i = 0; i < a.length(); i++) out.add(a.getString(i));
        } catch (Exception e) {
            // data rusak: anggap kosong
        }
        return out;
    }

    private static void savePending(Context context, Set<String> uids) {
        JSONArray a = new JSONArray();
        for (String u : uids) a.put(u);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_DONE, a.toString()).apply();
    }

    static synchronized void addPending(Context context, String uid) {
        Set<String> all = pending(context);
        all.add(uid);
        savePending(context, all);
    }

    static synchronized void removePending(Context context, Set<String> uids) {
        Set<String> all = pending(context);
        all.removeAll(uids);
        savePending(context, all);
    }

    private static int dotColor(int priority) {
        // prioritas aplikasi: 1 = tinggi, 2 = sedang, 3 = rendah
        if (priority <= 1) return Color.parseColor("#FF6B6B");
        if (priority == 2) return Color.parseColor("#FFC857");
        return Color.parseColor("#6FA8FF");
    }

    private static int resColor(Context context, int id) {
        return Build.VERSION.SDK_INT >= 23 ? context.getColor(id) : context.getResources().getColor(id);
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    }

    static RemoteViews build(Context context) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todo);
        String today = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ITEMS, "[]");
        Set<String> done = pending(context);

        int shown = 0, total = 0;
        try {
            JSONArray items = new JSONArray(raw);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                if (item.optString("d", "").compareTo(today) <= 0 && !done.contains(item.optString("u", ""))) total++;
            }
            for (int i = 0; i < items.length() && shown < MAX_ROWS; i++) {
                JSONObject item = items.getJSONObject(i);
                String date = item.optString("d", "");
                String uid = item.optString("u", "");
                if (date.compareTo(today) > 0 || done.contains(uid)) continue;
                boolean overdue = date.compareTo(today) < 0;
                String time = item.optString("h", "");
                String title = item.optString("t", "");
                boolean last = shown == MAX_ROWS - 1 && total > MAX_ROWS;
                SpannableStringBuilder text = new SpannableStringBuilder();
                if (last) {
                    text.append("+").append(String.valueOf(total - shown)).append(" tugas lagi");
                    views.setViewVisibility(CHK_IDS[shown], View.INVISIBLE);
                } else {
                    int start = 0;
                    if (overdue) {
                        text.append("! ");
                        text.setSpan(new ForegroundColorSpan(resColor(context, R.color.widget_overdue)), 0, 1, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
                        start = 2;
                    }
                    text.append("\\u25CF ");
                    text.setSpan(new ForegroundColorSpan(dotColor(item.optInt("p", 2))), start, start + 1, Spannable.SPAN_EXCLUSIVE_EXCLUSIVE);
                    if (!time.isEmpty()) text.append(time).append("  ");
                    text.append(title);
                    views.setViewVisibility(CHK_IDS[shown], View.VISIBLE);
                    views.setContentDescription(CHK_IDS[shown], "Selesaikan " + title);
                    Intent doneIntent = new Intent(context, TodoWidgetProvider.class);
                    doneIntent.setAction(ACTION_DONE);
                    doneIntent.setData(Uri.parse("todo://done/" + uid));
                    doneIntent.putExtra("uid", uid);
                    views.setOnClickPendingIntent(CHK_IDS[shown], PendingIntent.getBroadcast(context, 10 + shown, doneIntent, flags()));
                }
                views.setTextViewText(ROW_IDS[shown], text);
                views.setViewVisibility(LINE_IDS[shown], View.VISIBLE);
                shown++;
            }
        } catch (Exception e) {
            shown = 0;
            total = 0;
        }
        for (int i = shown; i < LINE_IDS.length; i++) views.setViewVisibility(LINE_IDS[i], View.GONE);
        views.setViewVisibility(R.id.widget_empty, total == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.widget_count, total == 0 ? "" : total + " tugas");

        Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launch != null) {
            views.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 0, launch, flags()));
            Intent add = new Intent(launch);
            add.putExtra(EXTRA_ACTION, "add");
            views.setOnClickPendingIntent(R.id.widget_add, PendingIntent.getActivity(context, 100, add, flags()));
        }
        return views;
    }
}
`;

const PLUGIN = `package __PKG__;

import android.content.Context;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.HashSet;
import java.util.Set;

/** Jembatan JS ↔ widget: dorong daftar tugas, ambil tugas yang dicentang di widget, dan ambil aksi "tambah". */
@CapacitorPlugin(name = "TodoWidget")
public class TodoWidgetPlugin extends Plugin {
    /** Diisi MainActivity saat aplikasi dibuka dari tombol "+" widget. */
    static volatile String pendingAction = "";

    @PluginMethod
    public void update(PluginCall call) {
        String items = call.getString("items", "[]");
        getContext().getSharedPreferences(TodoWidgetProvider.PREFS, Context.MODE_PRIVATE)
            .edit().putString(TodoWidgetProvider.KEY_ITEMS, items).apply();
        TodoWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    /** uid tugas yang dicentang di widget dan belum diterapkan aplikasi. */
    @PluginMethod
    public void completed(PluginCall call) {
        JSArray uids = new JSArray();
        for (String uid : TodoWidgetProvider.pending(getContext())) uids.put(uid);
        JSObject out = new JSObject();
        out.put("uids", uids);
        call.resolve(out);
    }

    /** Dipanggil setelah aplikasi menerapkan penyelesaian: hapus hanya uid yang disebut. */
    @PluginMethod
    public void clearCompleted(PluginCall call) {
        Set<String> gone = new HashSet<String>();
        try {
            JSArray list = call.getArray("uids");
            if (list != null) for (int i = 0; i < list.length(); i++) gone.add(list.getString(i));
        } catch (Exception e) {
            // abaikan: tidak ada yang dihapus
        }
        TodoWidgetProvider.removePending(getContext(), gone);
        TodoWidgetProvider.refreshAll(getContext());
        call.resolve();
    }

    /** Aksi dari widget ("add" atau kosong); dibaca sekali. */
    @PluginMethod
    public void action(PluginCall call) {
        JSObject out = new JSObject();
        out.put("action", pendingAction);
        pendingAction = "";
        call.resolve(out);
    }
}
`;

const ACTIVITY = `package __PKG__;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(TodoWidgetPlugin.class);
        super.onCreate(savedInstanceState);
        handleWidgetIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleWidgetIntent(intent);
    }

    private void handleWidgetIntent(Intent intent) {
        if (intent != null && "add".equals(intent.getStringExtra(TodoWidgetProvider.EXTRA_ACTION))) {
            TodoWidgetPlugin.pendingAction = "add";
            intent.removeExtra(TodoWidgetProvider.EXTRA_ACTION);
        }
    }
}
`;

const line = n => `    <LinearLayout
        android:id="@+id/widget_line${n}"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:gravity="center_vertical"
        android:orientation="horizontal"
        android:visibility="gone">

        <TextView
            android:id="@+id/widget_chk${n}"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:contentDescription="Selesaikan tugas"
            android:paddingBottom="5dp"
            android:paddingEnd="10dp"
            android:paddingStart="2dp"
            android:paddingTop="5dp"
            android:text="\u25CB"
            android:textColor="@color/widget_accent"
            android:textSize="20sp" />

        <TextView
            android:id="@+id/widget_row${n}"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:ellipsize="end"
            android:maxLines="1"
            android:textColor="@color/widget_text"
            android:textSize="14sp" />
    </LinearLayout>
`;

const LAYOUT = `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:orientation="vertical"
    android:padding="14dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal">

        <TextView
            android:id="@+id/widget_title"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Hari ini"
            android:textColor="@color/widget_text"
            android:textSize="16sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/widget_count"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_marginStart="8dp"
            android:layout_weight="1"
            android:textColor="@color/widget_muted"
            android:textSize="12sp" />

        <TextView
            android:id="@+id/widget_add"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:contentDescription="Tambah tugas"
            android:paddingBottom="2dp"
            android:paddingEnd="4dp"
            android:paddingStart="12dp"
            android:paddingTop="2dp"
            android:text="+"
            android:textColor="@color/widget_accent"
            android:textSize="26sp"
            android:textStyle="bold" />
    </LinearLayout>

${nums.map(line).join('')}
    <TextView
        android:id="@+id/widget_empty"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:text="Tidak ada tugas hari ini"
        android:textColor="@color/widget_muted"
        android:textSize="14sp"
        android:visibility="gone" />
</LinearLayout>
`;

const BACKGROUND = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="@color/widget_bg" />
    <corners android:radius="20dp" />
</shape>
`;

const colors = c => `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="widget_bg">${c.bg}</color>
    <color name="widget_text">${c.text}</color>
    <color name="widget_muted">${c.muted}</color>
    <color name="widget_accent">${c.accent}</color>
    <color name="widget_overdue">${c.overdue}</color>
</resources>
`;
const COLORS_LIGHT = colors({ bg: '#F5F8FB', text: '#15213B', muted: '#55637C', accent: '#1F3F9E', overdue: '#B3281D' });
const COLORS_DARK = colors({ bg: '#161F2E', text: '#E4EAF4', muted: '#97A5BC', accent: '#8AA6FF', overdue: '#FF9187' });

const INFO = `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:initialLayout="@layout/widget_todo"
    android:minHeight="140dp"
    android:minWidth="250dp"
    android:resizeMode="horizontal|vertical"
    android:updatePeriodMillis="1800000"
    android:widgetCategory="home_screen" />
`;

/* Daftar berkas relatif ke app/src/main/. */
function files(pkg) {
  const dir = 'java/' + pkg.replace(/\./g, '/') + '/';
  const sub = s => s.replace(/__PKG__/g, pkg);
  return [
    { path: dir + 'TodoWidgetProvider.java', content: sub(PROVIDER) },
    { path: dir + 'TodoWidgetPlugin.java', content: sub(PLUGIN) },
    { path: dir + 'MainActivity.java', content: sub(ACTIVITY), overwrite: true },
    { path: 'res/layout/widget_todo.xml', content: LAYOUT },
    { path: 'res/drawable/widget_bg.xml', content: BACKGROUND },
    { path: 'res/values/widget_colors.xml', content: COLORS_LIGHT },
    { path: 'res/values-night/widget_colors.xml', content: COLORS_DARK },
    { path: 'res/xml/todo_widget_info.xml', content: INFO },
  ];
}

const receiver = pkg => `        <receiver android:name="${pkg}.TodoWidgetProvider" android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/todo_widget_info" />
        </receiver>
`;

module.exports = { files, receiver, ROWS };
