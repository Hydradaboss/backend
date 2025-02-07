import { IUser } from '@/common/interfaces';
import { AppResponse, getFromCache, setCache, toJSON, uploadSingleFile } from '@/common/utils';
import AppError from '@/common/utils/appError';
import { catchAsync } from '@/queues/middlewares';
import { UserModel } from '@/models';
import type { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { Require_id } from 'mongoose';

export const updateProfilePhoto = catchAsync(async (req: Request, res: Response) => {
	const { file } = req;
	const userId = req.user?._id;

	if (!file) {
		throw new AppError(`File is required`, 400);
	}

	const dateInMilliseconds = DateTime.now().toMillis();
	const fileName = `${userId}/profile-image/${userId}-${dateInMilliseconds}.${file.mimetype.split('/')[1]}`;

	const uploadedFile = await uploadSingleFile({
		fileName,
		buffer: file.buffer,
		mimetype: file.mimetype,
	});

	const updatedUser = (await UserModel.findByIdAndUpdate(
		userId,
		{
			photo: uploadedFile,
		},
		{ new: true }
	)) as Require_id<IUser>;

	// delete previous photo from bucket
	const userFromCache = await getFromCache<Require_id<IUser>>(updatedUser._id.toString());

	if (userFromCache) {
		// update cache
		await setCache(updatedUser._id.toString()!, toJSON({ ...userFromCache, photo: updatedUser.photo }, []));
	}

	return AppResponse(res, 200, updatedUser, 'Profile photo updated successfully');
});
