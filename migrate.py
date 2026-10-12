#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
毕设接单管理助手 - 数据迁移工具
================================
功能：
1. 将旧文件夹结构迁移到新结构
   旧: 毕业设计/2026-学校名-项目名称
   新: 毕业设计/学校名/专业专业/2026-学生姓名-项目名称
2. 更新数据库中的 folderPath 字段

使用方法：
  python migrate.py
"""

import sqlite3
import os
import shutil
import sys
import time

# ===== 配置 =====
DB_PATH = r"C:\Users\王皓\Desktop\毕设接单管理助手\毕设接单管理助手\gradtrack.db"
BACKUP_SUFFIX = f".backup_{int(time.time())}"

TYPE_SUB_DIRS = {
    "thesis": "毕业设计",
    "format": "格式修改",
    "translation": "外文翻译",
}


def sanitize_path_part(s):
    """清理路径中的非法字符"""
    if not s:
        return ""
    return s.strip().replace("<", "_").replace(">", "_").replace(":", "_") \
        .replace('"', "_").replace("/", "_").replace("\\", "_") \
        .replace("|", "_").replace("?", "_").replace("*", "_")


def compute_new_folder_path(root_dir, order):
    """根据订单信息计算新的文件夹路径"""
    order_type = order["orderType"] or "thesis"
    sub_dir = TYPE_SUB_DIRS.get(order_type, "毕业设计")

    uni_name = sanitize_path_part(order["university"])
    major_name = sanitize_path_part(order["major"])
    student_name = sanitize_path_part(order["studentName"])
    title = sanitize_path_part(order["title"]) or "题目暂未确认"

    # 从旧路径中提取年份，或使用 createdAt
    year = "2026"
    if order["createdAt"]:
        year = order["createdAt"][:4]

    # 构建文件夹名称
    if student_name:
        folder_name = f"{year}-{student_name}-{title}"
    else:
        folder_name = f"{year}-{title}"

    # 构建完整路径
    new_path = os.path.join(root_dir, sub_dir, uni_name, f"{major_name}专业", folder_name)
    return new_path


def extract_root_dir(folder_path, order_type):
    """从现有的 folderPath 中提取根目录"""
    sub_dir = TYPE_SUB_DIRS.get(order_type or "thesis", "毕业设计")
    # 例: F:\小站论文工作室-2026订单\毕业设计\2026-xxx
    # 根目录为: F:\小站论文工作室-2026订单
    idx = folder_path.find(os.sep + sub_dir + os.sep)
    if idx == -1:
        # 尝试用反斜杠
        idx = folder_path.find("\\" + sub_dir + "\\")
    if idx == -1:
        return None
    return folder_path[:idx]


def main():
    print("=" * 60)
    print("  毕设接单管理助手 - 数据迁移工具")
    print("=" * 60)
    print()

    # 检查数据库文件
    if not os.path.exists(DB_PATH):
        print(f"[错误] 数据库文件不存在: {DB_PATH}")
        sys.exit(1)

    # 连接数据库（只读模式先分析）
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 读取所有订单
    orders = cur.execute(
        "SELECT id, title, university, major, studentName, folderPath, orderType, createdAt "
        "FROM Orders ORDER BY id ASC"
    ).fetchall()
    orders = [dict(o) for o in orders]

    print(f"[信息] 共找到 {len(orders)} 个订单")
    print()

    # 分析需要迁移的订单
    migration_plan = []
    skipped = []
    errors = []
    root_dir = None

    for order in orders:
        old_path = order["folderPath"]
        if not old_path:
            skipped.append((order["id"], order["title"], "无文件夹路径"))
            continue

        # 提取根目录（只需提取一次）
        if root_dir is None:
            root_dir = extract_root_dir(old_path, order["orderType"])
            if root_dir is None:
                errors.append((order["id"], order["title"], f"无法从路径提取根目录: {old_path}"))
                continue
            print(f"[信息] 检测到根目录: {root_dir}")
            print()

        # 计算新路径
        new_path = compute_new_folder_path(root_dir, order)

        # 检查旧文件夹是否存在
        old_exists = os.path.exists(old_path)

        if old_path == new_path:
            skipped.append((order["id"], order["title"], "路径无变化"))
            continue

        migration_plan.append({
            "id": order["id"],
            "title": order["title"],
            "university": order["university"],
            "major": order["major"],
            "studentName": order["studentName"],
            "old_path": old_path,
            "new_path": new_path,
            "old_exists": old_exists,
        })

    # 打印迁移计划
    print("=" * 60)
    print("  迁移计划预览")
    print("=" * 60)
    print()

    if skipped:
        print(f"--- 跳过 ({len(skipped)} 个) ---")
        for sid, stitle, reason in skipped:
            print(f"  ID:{sid} {stitle} - {reason}")
        print()

    if errors:
        print(f"--- 错误 ({len(errors)} 个) ---")
        for eid, etitle, reason in errors:
            print(f"  ID:{eid} {etitle} - {reason}")
        print()

    if not migration_plan:
        print("[信息] 没有需要迁移的订单")
        conn.close()
        return

    print(f"--- 需迁移 ({len(migration_plan)} 个) ---")
    print()
    for i, item in enumerate(migration_plan, 1):
        old_short = item["old_path"].replace(root_dir, ".")
        new_short = item["new_path"].replace(root_dir, ".")
        exists_mark = "✓" if item["old_exists"] else "✗"
        print(f"  [{i:02d}] ID:{item['id']} {item['title']}")
        print(f"       {item['university']} / {item['major']} / {item['studentName'] or '(无学生姓名)'}")
        print(f"       旧 [{exists_mark}]: {old_short}")
        print(f"       新    : {new_short}")
        print()

    # 统计
    exist_count = sum(1 for m in migration_plan if m["old_exists"])
    missing_count = len(migration_plan) - exist_count
    print(f"[统计] 文件夹存在: {exist_count} 个, 不存在: {missing_count} 个")
    print()

    # 确认执行
    print("=" * 60)
    answer = input("是否执行迁移？(输入 yes 确认): ").strip().lower()
    if answer != "yes":
        print("[取消] 迁移已取消")
        conn.close()
        return

    # ===== 执行迁移 =====
    print()
    print("[开始] 执行迁移...")
    print()

    # 步骤1：备份数据库
    backup_path = DB_PATH + BACKUP_SUFFIX
    shutil.copy2(DB_PATH, backup_path)
    print(f"[备份] 数据库已备份到: {backup_path}")

    # 步骤2：移动文件夹 + 更新数据库
    success_count = 0
    fail_count = 0

    for item in migration_plan:
        oid = item["id"]
        old_path = item["old_path"]
        new_path = item["new_path"]
        title = item["title"]

        try:
            # 创建新路径的父目录
            new_parent = os.path.dirname(new_path)
            os.makedirs(new_parent, exist_ok=True)

            # 移动文件夹（如果旧文件夹存在）
            if item["old_exists"]:
                if os.path.exists(new_path):
                    # 新路径已存在，合并内容
                    print(f"  [警告] ID:{oid} 新路径已存在，合并内容...")
                    for entry in os.listdir(old_path):
                        src = os.path.join(old_path, entry)
                        dst = os.path.join(new_path, entry)
                        if not os.path.exists(dst):
                            shutil.move(src, dst)
                    # 尝试删除旧目录（如果为空）
                    try:
                        os.rmdir(old_path)
                    except OSError:
                        pass
                else:
                    shutil.move(old_path, new_path)
                print(f"  [移动] ID:{oid} {title}")
            else:
                # 旧文件夹不存在，只创建新文件夹
                os.makedirs(new_path, exist_ok=True)
                print(f"  [创建] ID:{oid} {title} (旧文件夹不存在，已创建新文件夹)")

            # 更新数据库
            cur.execute("UPDATE Orders SET folderPath = ? WHERE id = ?", (new_path, oid))
            success_count += 1

        except Exception as e:
            print(f"  [失败] ID:{oid} {title} - {e}")
            fail_count += 1

    # 提交数据库更改
    conn.commit()

    # 步骤3：清理旧的空目录
    print()
    print("[清理] 删除旧的空目录...")
    if root_dir:
        for order_type_dir in TYPE_SUB_DIRS.values():
            type_path = os.path.join(root_dir, order_type_dir)
            if os.path.exists(type_path):
                # 遍历类型目录下的直接子目录，清理以 "2026-" 开头的空目录
                for entry in os.listdir(type_path):
                    entry_path = os.path.join(type_path, entry)
                    if os.path.isdir(entry_path) and entry.startswith("2026-"):
                        try:
                            # 检查是否为空目录
                            if not os.listdir(entry_path):
                                os.rmdir(entry_path)
                                print(f"  [删除] 空目录: {entry}")
                        except OSError:
                            pass

    conn.close()

    # 打印结果
    print()
    print("=" * 60)
    print("  迁移完成")
    print("=" * 60)
    print(f"  成功: {success_count} 个")
    print(f"  失败: {fail_count} 个")
    print(f"  数据库备份: {backup_path}")
    print()

    if fail_count > 0:
        print("[提示] 有失败的迁移项，请检查上方日志。")
        print(f"[提示] 如需回滚，请将备份文件 {backup_path} 还原为 {DB_PATH}")
    else:
        print("[提示] 所有迁移均成功完成！")
        print("[提示] 请启动应用验证数据是否正确。")


if __name__ == "__main__":
    main()
