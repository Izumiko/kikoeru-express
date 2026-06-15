CREATE TABLE `t_circle` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `t_review` (
	`user_name` text NOT NULL,
	`work_id` text NOT NULL,
	`rating` integer,
	`review_text` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`progress` text,
	CONSTRAINT `t_review_pk` PRIMARY KEY(`user_name`, `work_id`),
	CONSTRAINT `fk_t_review_user_name_t_user_name_fk` FOREIGN KEY (`user_name`) REFERENCES `t_user`(`name`) ON DELETE CASCADE,
	CONSTRAINT `fk_t_review_work_id_t_work_id_fk` FOREIGN KEY (`work_id`) REFERENCES `t_work`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `r_tag_work` (
	`tag_id` integer,
	`work_id` integer,
	CONSTRAINT `r_tag_work_pk` PRIMARY KEY(`tag_id`, `work_id`),
	CONSTRAINT `fk_r_tag_work_tag_id_t_tag_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `t_tag`(`id`),
	CONSTRAINT `fk_r_tag_work_work_id_t_work_id_fk` FOREIGN KEY (`work_id`) REFERENCES `t_work`(`id`)
);
--> statement-breakpoint
CREATE TABLE `t_tag` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `t_user` (
	`name` text PRIMARY KEY,
	`password` text NOT NULL,
	`group` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `t_va` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `r_va_work` (
	`va_id` text,
	`work_id` integer,
	CONSTRAINT `r_va_work_pk` PRIMARY KEY(`va_id`, `work_id`),
	CONSTRAINT `fk_r_va_work_va_id_t_va_id_fk` FOREIGN KEY (`va_id`) REFERENCES `t_va`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_r_va_work_work_id_t_work_id_fk` FOREIGN KEY (`work_id`) REFERENCES `t_work`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `t_work` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`root_folder` text NOT NULL,
	`dir` text NOT NULL,
	`title` text NOT NULL,
	`circle_id` integer NOT NULL,
	`nsfw` integer,
	`release` text,
	`dl_count` integer,
	`price` integer,
	`review_count` integer,
	`rate_count` integer,
	`rate_average_2dp` real,
	`rate_count_detail` text,
	`rank` text,
	CONSTRAINT `fk_t_work_circle_id_t_circle_id_fk` FOREIGN KEY (`circle_id`) REFERENCES `t_circle`(`id`)
);
--> statement-breakpoint
CREATE INDEX `t_work_index` ON `t_work` (`circle_id`,`release`,`dl_count`,`review_count`,`price`,`rate_average_2dp`);--> statement-breakpoint
CREATE VIEW `staticMetadata` AS 
  SELECT baseQueryWithVA.*,
    json_object('tags', json_group_array(json_object('id', t_tag.id, 'name', t_tag.name))) AS tagObj
  FROM (
    SELECT baseQuery.*,
      json_object('vas', json_group_array(json_object('id', t_va.id, 'name', t_va.name))) AS vaObj
    FROM (
      SELECT t_work.id,
        t_work.title,
        t_work.circle_id,
        t_circle.name,
        json_object('id', t_work.circle_id, 'name', t_circle.name) AS circleObj,
        t_work.nsfw,
        t_work.release,
        t_work.dl_count,
        t_work.price,
        t_work.review_count,
        t_work.rate_count,
        t_work.rate_average_2dp,
        t_work.rate_count_detail,
        t_work.rank
      FROM t_work
      JOIN t_circle ON t_circle.id = t_work.circle_id
    ) AS baseQuery
    JOIN r_va_work ON r_va_work.work_id = baseQuery.id
    JOIN t_va ON t_va.id = r_va_work.va_id
    GROUP BY baseQuery.id
  ) AS baseQueryWithVA
  LEFT JOIN r_tag_work ON r_tag_work.work_id = baseQueryWithVA.id
  LEFT JOIN t_tag ON t_tag.id = r_tag_work.tag_id
  GROUP BY baseQueryWithVA.id
;