const cartModel = require('../models/cartModel');
const rideModel = require('../models/rideModel');

module.exports = (io) => {
    io.on('connection', async (socket) => {
        console.log('A user connected:', socket.id);

        // Send initial state to the newly connected client
        const activeCarts = await cartModel.getAllCarts();
        socket.emit('initial-state', activeCarts);

        // Driver goes online
        socket.on('driver-online', async (data) => {
            const { cartId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                await cartModel.updateCart(cartId, { 
                    driverSocketId: socket.id, 
                    isOnline: true,
                    driverPhone: data.driverPhone || null,
                    driverName: data.driverName || 'Driver'
                });
                
                // Join a room specific to this driver/cart for direct messages
                socket.join(`driver_${cartId}`);
                console.log(`Driver for ${cartId} is online`);
                
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });

        // Driver location update
        socket.on('update-location', async (data) => {
            const { cartId, lat, lng } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.isOnline) {
                await cartModel.updateCart(cartId, { location: { lat, lng } });
                // Broadcast location to all clients
                io.emit('location-updated', { cartId, lat, lng });
            }
        });

        // Driver goes offline
        socket.on('driver-offline', async (data) => {
            const { cartId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                await cartModel.updateCart(cartId, { 
                    isOnline: false, 
                    driverSocketId: null 
                });
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });

        // Student requests a seat
        socket.on('request-seat', async (data) => {
            const { cartId, seatNumber, studentInfo, route } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber] && cart.seats[seatNumber].status === 'available') {
                await cartModel.updateCart(cartId, {
                    [`seats.${seatNumber}.status`]: 'pending',
                    [`seats.${seatNumber}.studentPhone`]: studentInfo.phone || null,
                    [`seats.${seatNumber}.studentName`]: studentInfo.name || 'Student',
                    [`seats.${seatNumber}.route`]: route || null
                });
                
                io.emit('seat-updated', { cartId, seatNumber, status: 'pending' });

                // Forward request to the specific driver
                if (cart.isOnline) {
                    io.to(`driver_${cartId}`).emit('ride-request', {
                        seatNumber,
                        studentInfo,
                        route,
                        requestId: socket.id // Use socket id to reply back
                    });
                } else {
                    // If driver is offline, auto-reject
                    await cartModel.updateCart(cartId, { [`seats.${seatNumber}.status`]: 'available' });
                    io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                    socket.emit('request-rejected', { message: 'Driver is currently offline.' });
                }
            } else {
                socket.emit('request-rejected', { message: 'Seat is no longer available.' });
            }
        });

        // Driver confirms the ride
        socket.on('confirm-ride', async (data) => {
            const { cartId, seatNumber, requestId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                const rideOtp = Math.floor(1000 + Math.random() * 9000).toString();
                
                const rideId = await rideModel.createRide({
                    cartId,
                    seatNumber,
                    driverPhone: cart.driverPhone || null,
                    driverName: cart.driverName || 'Driver',
                    studentPhone: cart.seats[seatNumber].studentPhone || null,
                    studentName: cart.seats[seatNumber].studentName || 'Student',
                    route: cart.seats[seatNumber].route || null,
                    price: 10
                });

                await cartModel.updateCart(cartId, {
                    [`seats.${seatNumber}.status`]: 'occupied',
                    [`seats.${seatNumber}.requestId`]: requestId,
                    [`seats.${seatNumber}.rideOtp`]: rideOtp,
                    [`seats.${seatNumber}.rideId`]: rideId
                });

                // Notify all clients that the seat is now occupied
                io.emit('seat-updated', { cartId, seatNumber, status: 'occupied' });
                
                // Send the specific OTP back to the student
                io.to(requestId).emit('request-accepted', { cartId, seatNumber, rideOtp });
            }
        });

        socket.on('start-ride', async (data) => {
            const { cartId, seatNumber, otp } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                if (cart.seats[seatNumber].rideOtp === otp) {
                    // OTP verified! Ride can start.
                    socket.emit('ride-started-success', { seatNumber });
                } else {
                    // Incorrect OTP
                    socket.emit('ride-started-error', { seatNumber, message: 'Invalid OTP' });
                }
            }
        });

        // Driver rejects the ride
        socket.on('reject-ride', async (data) => {
            const { cartId, seatNumber, requestId } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart) {
                await cartModel.updateCart(cartId, { [`seats.${seatNumber}.status`]: 'available' });
                
                // Notify everyone of the seat state change
                io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                
                // Notify the specific student
                io.to(requestId).emit('request-rejected', { message: 'Driver rejected the request.' });
            }
        });

        // Driver completes the ride for a seat
        socket.on('complete-ride', async (data) => {
            const { cartId, seatNumber } = data;
            const cart = await cartModel.getCart(cartId);
            
            if (cart && cart.seats[seatNumber]) {
                const requestId = cart.seats[seatNumber].requestId;
                const rideId = cart.seats[seatNumber].rideId;
                
                await cartModel.updateCart(cartId, {
                    [`seats.${seatNumber}.status`]: 'available',
                    [`seats.${seatNumber}.student`]: null,
                    [`seats.${seatNumber}.requestId`]: null,
                    [`seats.${seatNumber}.rideOtp`]: null,
                    [`seats.${seatNumber}.studentPhone`]: null,
                    [`seats.${seatNumber}.studentName`]: null,
                    [`seats.${seatNumber}.route`]: null,
                    [`seats.${seatNumber}.rideId`]: null
                });
                
                if (rideId) {
                    await rideModel.completeRide(rideId);
                }
                
                // Notify everyone
                io.emit('seat-updated', { cartId, seatNumber, status: 'available' });
                
                // Notify the specific student that the ride has ended
                if (requestId) {
                    io.to(requestId).emit('ride-completed', { message: 'Ride Ended' });
                }
            }
        });

        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.id);
            // Check if the disconnected user was a driver
            const allCarts = await cartModel.getAllCarts();
            let stateChanged = false;
            
            for (const cartId in allCarts) {
                if (allCarts[cartId].driverSocketId === socket.id) {
                    const cart = allCarts[cartId];
                    const seats = { ...cart.seats };
                    let seatsChanged = false;

                    // Reset any stuck pending seats
                    for (const seatNum in seats) {
                        if (seats[seatNum].status === 'pending') {
                            seats[seatNum].status = 'available';
                            seats[seatNum].studentPhone = null;
                            seats[seatNum].studentName = null;
                            seats[seatNum].route = null;
                            seatsChanged = true;
                        }
                    }

                    await cartModel.updateCart(cartId, {
                        isOnline: false,
                        driverSocketId: null,
                        ...(seatsChanged && { seats }) // Only update seats if we changed them
                    });
                    
                    console.log(`Driver for ${cartId} went offline unexpectedly`);
                    stateChanged = true;
                }
            }
            
            if (stateChanged) {
                const updatedCarts = await cartModel.getAllCarts();
                io.emit('cart-state-updated', updatedCarts);
            }
        });
    });
};
